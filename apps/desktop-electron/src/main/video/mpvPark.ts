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
 * Pure : le temps et la minuterie sont injectés, l'appelant (`ipc/videoLifecycle.ts`)
 * fait les gestes mpv.
 */

/** Délai de grâce : le temps qu'un épisode suivant, ou une reprise, se relance. */
export const PARK_GRACE_MS = 3000;

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
   * À l'expiration du délai, `onExpire` — l'arrêt réel — est appelé.
   */
  park(signature: string): void {
    this.cancel();
    this.signature = signature;
    this.handle = this.timers.set(() => {
      this.handle = null;
      this.signature = null;
      this.onExpire();
    }, this.graceMs);
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
