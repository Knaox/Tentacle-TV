/**
 * Octave — la navigation par ONGLETS du mobile et du web étroit (Accueil,
 * Rechercher, Bibliothèque, Hors ligne), règle PURE : quel onglet une adresse
 * allume, et sa racine. « Hors ligne » (lot fl, 30/10) a pour racine « Sur cet
 * appareil » ; il n'est montré qu'avec le droit du compte de l'appareil (porte du
 * hors ligne d'Octave, côté client). Une page de la bibliothèque (titres likés,
 * playlists) est dans « Bibliothèque » ; une page empilée sans onglet à elle (album, artiste,
 * playlist d'une extension, ambiance, réglages) garde l'onglet d'où l'on vient.
 */

import { OCTAVE_BASE_PATH, octavePaths } from "./octavePaths";

export const OCTAVE_TABS = ["home", "search", "library", "offline"] as const;
export type OctaveTab = (typeof OCTAVE_TABS)[number];

export const OCTAVE_TAB_ROOTS: Readonly<Record<OctaveTab, string>> = {
  home: octavePaths.home,
  search: octavePaths.search,
  library: octavePaths.library,
  offline: octavePaths.device,
};

const LIBRARY_PAGES = ["library", "liked", "playlists", "playlist"];

/** Le chemin sans sa question ni sa barre finale. */
function bare(path: string): string {
  const cut = path.split(/[?#]/)[0] ?? "";
  return cut.length > 1 && cut.endsWith("/") ? cut.slice(0, -1) : cut;
}

/** L'onglet allumé sur `path` ; `previous` pour une page empilée sans onglet à elle. */
export function octaveTabOf(path: string, previous: OctaveTab = "home"): OctaveTab {
  const p = bare(path);
  if (p === OCTAVE_BASE_PATH) return "home";
  if (!p.startsWith(`${OCTAVE_BASE_PATH}/`)) return previous;
  const first = p.slice(OCTAVE_BASE_PATH.length + 1).split("/")[0] ?? "";
  if (first === "search") return "search";
  if (first === "device") return "offline";
  if (LIBRARY_PAGES.includes(first)) return "library";
  return previous;
}

/** `path` est-il la RACINE d'un onglet (pas une page empilée dessus) ? */
export function isOctaveTabRoot(path: string): boolean {
  const p = bare(path);
  return OCTAVE_TABS.some((tab) => OCTAVE_TAB_ROOTS[tab] === p);
}
