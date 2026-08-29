/**
 * Journal des requêtes SORTANTES de la page — DÉVELOPPEMENT UNIQUEMENT.
 *
 * # La question à laquelle il répond
 *
 * « Quand je lis un fichier LOCAL alors que j'ai internet, est-ce que l'app
 * parle encore au serveur ? » Aucune ligne du panneau ne pouvait le dire : la
 * ligne `Flux` répond pour les octets de la VIDÉO, pas pour les métadonnées —
 * segments d'intro et d'outro, chapitres, préférences de pistes, progression.
 * Or ce sont elles qui décident si la lecture hors ligne tient vraiment.
 *
 * Une absence est une information : le journal doit donc être visible même
 * vide, et surtout pouvoir être VIDÉ juste avant de lancer le film. Ce qui
 * apparaît ensuite est exactement ce que la lecture a provoqué.
 *
 * # Ce qu'il ne voit pas
 *
 * Uniquement le `fetch` de la PAGE. mpv ouvre ses propres flux (le média, les
 * sous-titres passés par `sub-add`) depuis le processus natif, et le moteur de
 * téléchargement passe par `net.fetch` côté processus principal : ni l'un ni
 * l'autre n'apparaît ici. La ligne `Flux` couvre le premier, le terminal le
 * second.
 */

/** Une requête observée, en vol ou terminée. */
export interface OutgoingRequest {
  /** Horodatage du DÉPART. */
  at: number;
  method: string;
  url: string;
  /** `null` tant que la réponse n'est pas revenue. */
  status: number | null;
  durationMs: number | null;
  /** Rejet réseau — distinct d'un statut d'erreur, qui est une réponse. */
  failed: boolean;
}

/** Au-delà, les plus anciennes tombent : c'est le récent qui informe. */
const DEFAULT_MAX = 60;

export interface Probe {
  /** `fetch` instrumenté, à poser à la place de l'original. */
  fetch: typeof fetch;
  log: () => readonly OutgoingRequest[];
  clear: () => void;
}

/**
 * Fabrique une sonde autour d'un `fetch`.
 *
 * Le `fetch` et l'horloge entrent par la porte : c'est ce qui rend le journal
 * vérifiable sans navigateur ni réseau.
 */
export function createProbe(deps: {
  fetch: typeof fetch;
  now: () => number;
  max?: number;
}): Probe {
  const max = deps.max ?? DEFAULT_MAX;
  let log: OutgoingRequest[] = [];

  const instrumented: typeof fetch = async (input, init) => {
    const entry: OutgoingRequest = {
      at: deps.now(),
      method: methodOf(input, init),
      url: urlOf(input),
      status: null,
      durationMs: null,
      failed: false,
    };
    log.push(entry);
    if (log.length > max) log = log.slice(-max);

    try {
      const response = await deps.fetch(input, init);
      entry.status = response.status;
      entry.durationMs = deps.now() - entry.at;
      return response;
    } catch (error) {
      // Un rejet n'est PAS un statut : hors ligne, la distinction est toute la
      // différence entre « le serveur a répondu non » et « il n'y a personne ».
      entry.failed = true;
      entry.durationMs = deps.now() - entry.at;
      throw error;
    }
  };

  return {
    fetch: instrumented,
    log: () => log,
    clear: () => {
      log = [];
    },
  };
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function methodOf(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input !== "string" && !(input instanceof URL)) return input.method.toUpperCase();
  return "GET";
}

let active: Probe | null = null;

/**
 * Remplace `window.fetch`. Idempotent — un second appel ne réenveloppe pas,
 * ce qui compterait chaque requête deux fois.
 */
export function installNetworkProbe(): void {
  if (active !== null || typeof window === "undefined") return;
  active = createProbe({ fetch: window.fetch.bind(window), now: () => Date.now() });
  window.fetch = active.fetch;
}

/** Ce qui est sorti, du plus ancien au plus récent. */
export function outgoingRequests(): readonly OutgoingRequest[] {
  return active?.log() ?? [];
}

/** Vide le journal — à faire juste avant de lancer une lecture. */
export function clearNetworkProbe(): void {
  active?.clear();
}
