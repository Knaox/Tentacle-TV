/**
 * mpv gardé AU CHAUD entre deux épisodes — le parking.
 *
 * # Ce que coûte une instance neuve, mesuré le 17.09.2026 (Linux, RTX 5090)
 *
 * Le lecteur est remonté à chaque épisode (`key={itemId}`), et avec lui mpv :
 * `mpv_destroy` puis `mpv_init`, une sortie vidéo neuve à chaque fois. Journal
 * verbeux de mpv, épisode léger en réseau local :
 *
 *     ouverture du démuxeur                           153 ms
 *     énumération des extensions Vulkan (12 couches)  134 ms  « slow! »
 *     vkCreateDevice sur NVIDIA                        569 ms  « slow! »
 *     chargement du décodeur CUDA (nvdec)               62 ms
 *     première image                                  ~100 ms
 *
 * Trois quarts de seconde pour REFAIRE ce que l'épisode précédent avait déjà :
 * Windows (D3D11) et macOS (MoltenVK) créent leur périphérique en quelques
 * dizaines de millisecondes, d'où « instantané » là-bas et pas ici.
 *
 * # Ce qu'on fait : ne pas détruire, garer
 *
 * À `mpv_destroy`, on ne détruit plus : `force-window=yes` puis `stop`. mpv
 * retombe à l'idle en gardant sa sortie vidéo — vérifié dans les sources 0.41
 * (`player/playloop.c`, `idle_loop` → `handle_force_window(true)` : avec
 * `force-window` posé, la fenêtre reste, à sa taille puisque
 * `auto-window-resize=no`) — et sa fenêtre reste collée sous la nôtre, opaque
 * à cet instant (`setSurfaceOpaque` au démontage du lecteur). Si un `mpv_init`
 * arrive pendant le délai de grâce avec les MÊMES options, il réutilise
 * l'instance : le `loadfile` suivant remplace le fichier dans la sortie vidéo
 * existante — même VkDevice, même décodeur, même fenêtre. Sinon le délai
 * expire et l'arrêt gracieux (`mpvShutdown.ts`) fait ce qu'il faisait.
 *
 * Réservé au montage Wayland + colle : c'est le seul où la fenêtre garée est
 * garantie SOUS la nôtre. En plein écran forcé (GNOME) une fenêtre mpv idle
 * resterait plein écran derrière une page revenue en fenêtré ; Windows et
 * macOS n'ont pas ce coût de création.
 *
 * # Trois secondes ne suffisaient pas (29.09.2026)
 *
 * Symptôme rapporté : « le même titre repart vite, un AUTRE titre est lent, et
 * le premier est toujours lent » — le retour à la bibliothèque dépasse trois
 * secondes, et la première lecture d'un lancement n'avait rien à reprendre.
 * Banc (libmpv du paquet, options de l'app, KWin virtuel, RTX 5090), de
 * `loadfile` à la première image, sur quatre titres différents :
 *
 *     instance neuve                          687-810 ms
 *     instance reprise (chaude, après lecture)  78-87 ms
 *     instance PRÉCHAUFFÉE, jamais lue          79-154 ms (+70 ms d'interop
 *                                             CUDA au premier titre seulement)
 *
 * Mais une instance garée APRÈS une lecture garde tout : 864 Mio de VRAM après
 * un 1080p nvdec, 2 079 Mio après un 4K HDR — le pool de surfaces du décodeur,
 * retenu par la dernière image. Préchauffée sans jamais lire : 91 Mio, aucun
 * contexte CUDA. D'où deux parkings :
 *
 * - l'instance CHAUDE, après une lecture, le temps d'enchaîner ou de revenir
 *   (`HOT_PARK_MS`) ;
 * - puis l'instance MINCE : la chaude est arrêtée et une neuve est préchauffée
 *   à sa place, gardée sans limite — 91 Mio pour que le titre suivant, quel
 *   qu'il soit, démarre en ~150 ms. `mpv_prewarm` fait naître la même au
 *   lancement de l'application.
 *
 * Sur batterie, rien de tout cela : un VkDevice tenu garde éveillé le GPU
 * dédié d'un portable hybride. Le délai redevient celui d'un épisode suivant
 * (`PARK_GRACE_MS`), sans recyclage ni préchauffage.
 *
 * Pure : le temps et la minuterie sont injectés, l'appelant (`ipc/videoLifecycle.ts`)
 * fait les gestes mpv.
 */

/** Délai de grâce sur batterie : le temps qu'un épisode suivant, ou une reprise, se relance. */
export const PARK_GRACE_MS = 3000;

/** Sur secteur : l'instance chaude attend le titre suivant une minute, puis se recycle. */
export const HOT_PARK_MS = 60_000;

/** Ce que la source d'alimentation permet. */
export interface ParkPolicy {
  /** Le délai de l'instance chaude, après une lecture. */
  hotGraceMs: number;
  /** À son expiration, une instance mince (préchauffée) la remplace. */
  recycle: boolean;
  /** Une instance mince peut naître d'avance, à la demande de la page. */
  prewarm: boolean;
}

/** La politique du parking, selon que la machine est sur batterie ou non. */
export function parkPolicy(onBattery: boolean): ParkPolicy {
  return onBattery
    ? { hotGraceMs: PARK_GRACE_MS, recycle: false, prewarm: false }
    : { hotGraceMs: HOT_PARK_MS, recycle: true, prewarm: true };
}

export interface ParkTimers {
  set: (callback: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
}

const REAL_TIMERS: ParkTimers = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export class Park {
  private handle: unknown = null;
  private signature: string | null = null;

  constructor(
    private readonly onExpire: () => void,
    private readonly graceMs: number = PARK_GRACE_MS,
    private readonly timers: ParkTimers = REAL_TIMERS,
  ) {}

  /** Une instance est garée ? */
  isParked(): boolean {
    return this.signature !== null;
  }

  /**
   * Gare l'instance vivante, identifiée par la signature de ses options.
   * À l'expiration du délai, `onExpire` — l'arrêt réel — est appelé ; un délai
   * `null` n'expire jamais (l'instance mince).
   */
  park(signature: string, graceMs: number | null = this.graceMs): void {
    this.cancel();
    this.signature = signature;
    if (graceMs === null) return;
    this.handle = this.timers.set(() => {
      this.handle = null;
      this.signature = null;
      this.onExpire();
    }, graceMs);
  }

  /**
   * Reprend l'instance garée si ses options sont celles demandées. Dans les
   * deux cas le parking se vide : refusée, l'instance sera arrêtée par
   * l'appelant, pas par l'expiration.
   */
  reuse(signature: string): boolean {
    const same = this.signature !== null && this.signature === signature;
    this.cancel();
    return same;
  }

  /** Vide le parking SANS arrêter : l'appelant a décidé lui-même. */
  cancel(): void {
    if (this.handle !== null) this.timers.clear(this.handle);
    this.handle = null;
    this.signature = null;
  }
}

/**
 * La signature des options d'init : ce qui, changé, exige une instance neuve.
 * `geometry` en est exclu — c'est une taille de NAISSANCE, sans objet pour une
 * fenêtre qui existe déjà.
 */
export function optionsSignature(
  options: Readonly<Record<string, string | number | boolean>>,
  observed: ReadonlyArray<readonly [string, string]>,
): string {
  const { geometry: _birth, ...rest } = options;
  return JSON.stringify({ options: rest, observed });
}
