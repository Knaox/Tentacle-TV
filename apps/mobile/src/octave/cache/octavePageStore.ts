/**
 * Octave (mobile) — la PAGE où l'on est, gardée pour le prochain lancement
 * (`tentacle_octave_page`, même clé et même forme que le bureau) : l'adresse
 * dès qu'elle change, le défilement à la fin d'un geste (au plus une écriture
 * par 400 ms). Au lancement en Octave, on arrive sur l'ACCUEIL, en haut (lot
 * « fl », 30/10 : la règle partagée `octavePageResume.ts` ne rejoue plus la
 * page gardée). Rien d'écrit sans identité.
 */

import { OCTAVE_BASE_PATH, OCTAVE_PAGE_KEY, resumeScroll, type SavedOctavePage } from "@tentacle-tv/shared/octave/mode";
import { octaveLaunch } from "../launch/octaveLaunch";
import { octaveOwnerOf, SERVER_URL_KEY, STORED_USER_KEY } from "../launch/octaveLaunchRules";
import { octaveStorage } from "../mode/octaveModeStore";

const WRITE_DELAY_MS = 400;

let page: SavedOctavePage | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let launchScrollTaken = false;

/** L'identité de la session en cours (serveur + compte, profil compris), ou null. */
export function currentOctaveOwner(): string | null {
  const storage = octaveStorage();
  return storage ? octaveOwnerOf(storage.getItem(SERVER_URL_KEY), storage.getItem(STORED_USER_KEY)) : null;
}

function flush(): void {
  timer = null;
  if (page) octaveStorage()?.setItem(OCTAVE_PAGE_KEY, JSON.stringify(page));
}

function schedule(): void {
  if (timer === null) timer = setTimeout(flush, WRITE_DELAY_MS);
}

/** L'adresse affichée (chemin + question) : gardée, défilement remis à zéro sur une autre page. */
export function rememberOctavePath(path: string): void {
  const owner = currentOctaveOwner();
  if (owner === null) return;
  if (page?.path === path && page.owner === owner) return;
  // La page gardée du lancement garde son défilement tant qu'aucun geste ne l'a changé.
  const saved = octaveLaunch().savedPage;
  const scrollTop = saved && saved.owner === owner && saved.path === path ? saved.scrollTop : 0;
  page = { owner, path, scrollTop, savedAt: Date.now() };
  schedule();
}

/** Le défilement de la page affichée, à la fin d'un geste. */
export function rememberOctaveScroll(path: string, scrollTop: number): void {
  if (!page || page.path !== path) return;
  page = { ...page, scrollTop: Math.max(0, Math.round(scrollTop)), savedAt: Date.now() };
  schedule();
}

/** Le défilement à rejouer sur `path`, une seule fois par lancement (null : rien). */
export function takeLaunchScroll(path: string): number | null {
  if (launchScrollTaken) return null;
  const launch = octaveLaunch();
  if (!launch.inOctave || launch.path !== path) return null;
  launchScrollTaken = true;
  return resumeScroll(launch.savedPage, launch.owner, Date.now(), OCTAVE_BASE_PATH, path);
}
