/**
 * Octave — la PAGE où l'on était en quittant (adresse et défilement), gardée
 * sur l'appareil par identité (`tentacle_octave_page`, stockage local, aucun
 * secret : une adresse d'Octave et un nombre de pixels). Au lancement en
 * Octave, on y retombe littéralement ; la règle est pure
 * (`pageResume.test.ts`), le stockage protégé (illisible = l'accueil).
 * Clé de stockage : elle ne se renomme jamais.
 */

export const OCTAVE_PAGE_KEY = "tentacle_octave_page";

/** Au-delà, la page gardée ne vaut plus : on rouvre l'accueil d'Octave. */
export const PAGE_RESUME_MAX_AGE_MS = 30 * 24 * 3_600_000;

export interface SavedOctavePage {
  owner: string;
  /** `pathname` + `search` (une recherche garde sa question). */
  path: string;
  scrollTop: number;
  savedAt: number;
}

/** Une adresse d'Octave qu'on peut rouvrir (jamais une adresse hors du mode). */
export function isOctavePath(path: string, basePath: string): boolean {
  return path === basePath || path.startsWith(`${basePath}/`) || path.startsWith(`${basePath}?`);
}

function valid(saved: SavedOctavePage | null, owner: string | null, now: number, basePath: string): saved is SavedOctavePage {
  if (!saved || owner === null || saved.owner !== owner) return false;
  if (now - saved.savedAt > PAGE_RESUME_MAX_AGE_MS || saved.savedAt > now + 60_000) return false;
  return isOctavePath(saved.path, basePath);
}

/** Où arriver au lancement : la page gardée de CETTE identité, sinon l'accueil d'Octave. */
export function resumePath(saved: SavedOctavePage | null, owner: string | null, now: number, basePath: string): string {
  return valid(saved, owner, now, basePath) ? saved.path : basePath;
}

/** Le défilement à rejouer, seulement sur la page gardée elle-même. */
export function resumeScroll(saved: SavedOctavePage | null, owner: string | null, now: number, basePath: string, path: string): number | null {
  if (!valid(saved, owner, now, basePath) || saved.path !== path) return null;
  return saved.scrollTop > 0 ? saved.scrollTop : null;
}

export function readSavedOctavePage(): SavedOctavePage | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(OCTAVE_PAGE_KEY) ?? "null") as Partial<SavedOctavePage> | null;
    if (!parsed || typeof parsed.owner !== "string" || typeof parsed.path !== "string") return null;
    const scrollTop = typeof parsed.scrollTop === "number" && Number.isFinite(parsed.scrollTop) ? Math.max(0, Math.round(parsed.scrollTop)) : 0;
    return { owner: parsed.owner, path: parsed.path, scrollTop, savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0 };
  } catch {
    return null;
  }
}

let atLaunch: SavedOctavePage | null | undefined;
let reached = false;

/** Une page d'Octave a été montée dans ce chargement (la page gardée du lancement est consommée). */
export function octavePageReached(): boolean {
  return reached;
}

export function markOctavePageReached(): void {
  reached = true;
}

/** La page gardée telle qu'elle était au LANCEMENT (lue une fois : les écritures de la session ne la changent plus). */
export function savedOctavePageAtLaunch(): SavedOctavePage | null {
  if (atLaunch === undefined) atLaunch = readSavedOctavePage();
  return atLaunch;
}

export function writeSavedOctavePage(page: SavedOctavePage): void {
  try {
    localStorage.setItem(OCTAVE_PAGE_KEY, JSON.stringify(page));
  } catch {
    /* stockage plein ou bloqué : le prochain lancement rouvrira l'accueil */
  }
}

export function forgetSavedOctavePage(): void {
  try {
    localStorage.removeItem(OCTAVE_PAGE_KEY);
  } catch {
    /* rien à oublier */
  }
}

/**
 * Le défilement à rejouer, une fois par chargement : `undefined` pas encore lu,
 * un nombre EN ATTENTE pour `pendingPath`, `null` rien (ou fait). Il n'est
 * consommé que par le rejeu réussi, un geste de l'utilisateur ou le délai —
 * jamais par un démontage (le double montage de StrictMode le perdait).
 */
let pending: number | null | undefined;
let pendingPath: string | null = null;

/** Au premier montage du chargement : la cible pour CETTE page (lue une seule fois). */
export function beginScrollResume(owner: string | null, path: string, basePath: string, now: number = Date.now()): void {
  if (pending !== undefined) return;
  pending = resumeScroll(savedOctavePageAtLaunch(), owner, now, basePath, path);
  pendingPath = path;
}

/** Le défilement encore à rejouer sur `path`, ou null. */
export function pendingScrollFor(path: string): number | null {
  return typeof pending === "number" && pendingPath === path ? pending : null;
}

/** Le rejeu a eu lieu (ou n'aura plus lieu : geste, délai, autre page). */
export function settleScrollResume(): void {
  pending = null;
}

/** Ce qu'on écrit pour `path` : la cible tant que son rejeu attend (jamais le 0 d'avant le contenu), sinon `current`. */
export function scrollToSave(path: string, current: number): number {
  return pendingScrollFor(path) ?? Math.round(current);
}

/** Pour les tests. */
export function resetScrollResumeForTests(): void {
  pending = undefined;
  pendingPath = null;
  atLaunch = undefined;
  reached = false;
}
