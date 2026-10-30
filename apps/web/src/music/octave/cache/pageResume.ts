/**
 * Octave — la PAGE où l'on était en quittant (adresse et défilement), gardée
 * sur l'appareil par identité (`tentacle_octave_page`, stockage local, aucun
 * secret : une adresse d'Octave et un nombre de pixels). Au lancement en
 * Octave, on arrive sur l'ACCUEIL, en haut (lot « fl », 30/10 : la page gardée
 * ne décide plus de l'arrivée — `octavePageResume.ts`) ; la règle est pure
 * (`pageResume.test.ts`), le stockage protégé (illisible = l'accueil).
 * Clé de stockage : elle ne se renomme jamais.
 */

import { OCTAVE_PAGE_KEY, parseSavedOctavePage, resumeScroll, type SavedOctavePage } from "@tentacle-tv/shared/octave/mode";

// La règle est partagée avec le mobile (`@tentacle-tv/shared/octave/mode`, `octavePageResume.ts`).
export {
  OCTAVE_PAGE_KEY, PAGE_RESUME_MAX_AGE_MS, isOctavePath, resumePath, resumeScroll, type SavedOctavePage,
} from "@tentacle-tv/shared/octave/mode";

export function readSavedOctavePage(): SavedOctavePage | null {
  try {
    return parseSavedOctavePage(localStorage.getItem(OCTAVE_PAGE_KEY));
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
