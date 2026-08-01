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
export interface RequeteSortante {
  /** Horodatage du DÉPART. */
  at: number;
  methode: string;
  url: string;
  /** `null` tant que la réponse n'est pas revenue. */
  status: number | null;
  dureeMs: number | null;
  /** Rejet réseau — distinct d'un statut d'erreur, qui est une réponse. */
  echec: boolean;
}

/** Au-delà, les plus anciennes tombent : c'est le récent qui informe. */
const MAX_PAR_DEFAUT = 60;

export interface Sonde {
  /** `fetch` instrumenté, à poser à la place de l'original. */
  fetch: typeof fetch;
  journal: () => readonly RequeteSortante[];
  vider: () => void;
}

/**
 * Fabrique une sonde autour d'un `fetch`.
 *
 * Le `fetch` et l'horloge entrent par la porte : c'est ce qui rend le journal
 * vérifiable sans navigateur ni réseau.
 */
export function creerSonde(deps: {
  fetch: typeof fetch;
  now: () => number;
  max?: number;
}): Sonde {
  const max = deps.max ?? MAX_PAR_DEFAUT;
  let journal: RequeteSortante[] = [];

  const instrumente: typeof fetch = async (entree, init) => {
    const entry: RequeteSortante = {
      at: deps.now(),
      methode: methodeDe(entree, init),
      url: urlDe(entree),
      status: null,
      dureeMs: null,
      echec: false,
    };
    journal.push(entry);
    if (journal.length > max) journal = journal.slice(-max);

    try {
      const reponse = await deps.fetch(entree, init);
      entry.status = reponse.status;
      entry.dureeMs = deps.now() - entry.at;
      return reponse;
    } catch (erreur) {
      // Un rejet n'est PAS un statut : hors ligne, la distinction est toute la
      // différence entre « le serveur a répondu non » et « il n'y a personne ».
      entry.echec = true;
      entry.dureeMs = deps.now() - entry.at;
      throw erreur;
    }
  };

  return {
    fetch: instrumente,
    journal: () => journal,
    vider: () => {
      journal = [];
    },
  };
}

function urlDe(entree: RequestInfo | URL): string {
  if (typeof entree === "string") return entree;
  if (entree instanceof URL) return entree.toString();
  return entree.url;
}

function methodeDe(entree: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof entree !== "string" && !(entree instanceof URL)) return entree.method.toUpperCase();
  return "GET";
}

let active: Sonde | null = null;

/**
 * Remplace `window.fetch`. Idempotent — un second appel ne réenveloppe pas,
 * ce qui compterait chaque requête deux fois.
 */
export function installerSondeReseau(): void {
  if (active !== null || typeof window === "undefined") return;
  active = creerSonde({ fetch: window.fetch.bind(window), now: () => Date.now() });
  window.fetch = active.fetch;
}

/** Ce qui est sorti, du plus ancien au plus récent. */
export function requetesSortantes(): readonly RequeteSortante[] {
  return active?.journal() ?? [];
}

/** Vide le journal — à faire juste avant de lancer une lecture. */
export function viderSondeReseau(): void {
  active?.vider();
}
