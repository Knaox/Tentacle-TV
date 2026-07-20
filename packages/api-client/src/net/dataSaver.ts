/**
 * Mode économie de données — état partagé, relu à l'exécution par les couches
 * réseau (hubs de la home, constructeur d'URL d'images, reporting de lecture).
 *
 * INVERSION DE DÉPENDANCE : `api-client` ne connaît rien de la connectivité,
 * qui vit côté application (`apps/web/src/offline`). C'est l'app qui pousse
 * l'état ICI via `setDataSaverActive`, exactement comme elle pousse les URLs
 * backend via `setPreferencesBackendUrl` & co. Le paquet reste utilisable par
 * le mobile et la TV, qui ne poussent simplement jamais rien (mode inactif).
 *
 * Les quotas sont exposés en FONCTIONS, jamais en constantes : ils doivent être
 * relus à chaque exécution de `queryFn`. Figés à la définition du hook, un
 * changement de mode ne s'appliquerait qu'après rechargement complet de l'app.
 *
 * On ne déclenche volontairement AUCUNE invalidation au changement de mode :
 * les nouveaux quotas s'appliquent au prochain refetch naturel (staleTime
 * écoulé, retour sur la home, WebSocket). Invalider forcerait un re-fetch
 * complet au moment précis où l'on cherche à économiser.
 */

let active = false;
const listeners = new Set<() => void>();

export function isDataSaverActive(): boolean {
  return active;
}

export function setDataSaverActive(next: boolean): void {
  if (active === next) return;
  active = next;
  for (const l of listeners) l();
}

export function subscribeDataSaver(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* ── Quotas de la page d'accueil ──────────────────────────────────────────── */

export interface HomeLimits {
  /** Épisodes non vus alimentant le supplément « intelligent » de NextUp. */
  unwatched: number;
  /** Épisodes vus alimentant le classement par engagement. */
  engaged: number;
  /** Fenêtre d'épisodes récents récupérée avant regroupement par série. */
  latestEpisodes: number;
}

const HOME_NORMAL: HomeLimits = { unwatched: 250, engaged: 300, latestEpisodes: 100 };
/** ~2,7 Mo → ~1,1 Mo bruts. Le carrousel n'affiche que 12 items au final et le
 *  supplément est plafonné à 24 : ces fenêtres restent largement suffisantes,
 *  au prix d'une couverture de séries moindre (le NextUp officiel, lui, est
 *  intact — la dégradation est déjà prévue par `useNextUp`). */
const HOME_SAVER: HomeLimits = { unwatched: 60, engaged: 80, latestEpisodes: 40 };

export function homeLimits(): HomeLimits {
  return active ? HOME_SAVER : HOME_NORMAL;
}

/** Multiplicateur de fraîcheur. `refetchOnMount` vaut `true` par défaut : sans
 *  cela, chaque retour sur la home relance tout le fan-out dès le staleTime
 *  écoulé. */
export function staleFactor(): number {
  return active ? 6 : 1;
}

/* ── Budget images ────────────────────────────────────────────────────────── */

export interface ImageBudget {
  /** Facteur appliqué à `maxWidth` / `maxHeight`. */
  scale: number;
  /** Plafond appliqué à `quality` (les appelants demandent 80 à 90). */
  maxQuality: number;
}

const IMAGE_NORMAL: ImageBudget = { scale: 1, maxQuality: 100 };
/** Les images pèsent ~75 % du fil et sont incompressibles : c'est le principal
 *  gisement. 0,65× en dimensions et q60 divisent leur poids par ~3. */
const IMAGE_SAVER: ImageBudget = { scale: 0.65, maxQuality: 60 };

export function imageBudget(): ImageBudget {
  return active ? IMAGE_SAVER : IMAGE_NORMAL;
}

/* ── Reporting de position en lecture LOCALE ──────────────────────────────── */

/**
 * - `heartbeat` : `POST /Sessions/Playing/Progress` toutes les 10 s (historique).
 * - `edges` : début et fin seulement. La position intermédiaire continue d'être
 *   écrite en SQLite toutes les 10 s (0 octet réseau) et rejoint la file de
 *   resynchronisation, drainée au lancement suivant — donc rien n'est perdu,
 *   même sur crash. ~720 requêtes → 2 sur un film de 2 h.
 */
export type LocalReportMode = "heartbeat" | "edges";

export function localReportMode(): LocalReportMode {
  return active ? "edges" : "heartbeat";
}
