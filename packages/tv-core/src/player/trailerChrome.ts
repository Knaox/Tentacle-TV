/**
 * L'écran de BANDE-ANNONCE d'un téléviseur — un lecteur ULTRA simplifié :
 * avancer / reculer, la pause, et (si le serveur sait les servir) les
 * sous-titres et la qualité. Rien d'autre. Module pur : la plateforme compte
 * le temps, pose le focus, recule.
 *
 * - Les cibles, l'entrée et les voisins : `trailerFocus.ts` ; les contrôles
 *   (ceux du grand lecteur) : `trailerControls.ts` ; le Retour :
 *   `trailerBack.ts` ; les panneaux : `trailerPanels.ts`.
 * - La lecture COMMENCE habillage tu (`trailerChromeSync`), comme le lecteur
 *   d'un film : il ne paraît qu'à un geste.
 * - Le chrome (la croix, le titre, les boutons, la barre) s'estompe
 *   `TRAILER_IDLE_MS` après le dernier geste, en LECTURE seulement : jamais
 *   pendant le chargement ni sur « indisponible » (`trailerChromeShown`),
 *   jamais en pause ni panneau ouvert (les contrôles n'arment pas l'attente).
 * - « Indisponible » rend la fiche d'elle-même après
 *   `TRAILER_UNAVAILABLE_RETURN_MS`, le temps de lire la phrase (BA-3).
 */

/** La croix Retour : l'entrée hors lecture (`trailerFocus.ts`). */
export const TRAILER_CLOSE_KEY = "trailer:close";

/** Le délai sans geste au bout duquel le chrome s'estompe, en lecture (`createTrailerControls`). */
export const TRAILER_IDLE_MS = 3000;

/** Le temps de lire « indisponible » avant de rendre la fiche. */
export const TRAILER_UNAVAILABLE_RETURN_MS = 4000;

export type TrailerState = "loading" | "playing" | "unavailable";

/** Ce que montre l'écran : rien à lire (ou un échec), la lecture, ou le chargement. */
export function trailerState(state: { canPlay: boolean; failed: boolean; loaded: boolean }): TrailerState {
  if (!state.canPlay || state.failed) return "unavailable";
  return state.loaded ? "playing" : "loading";
}

/** Ce qui est à l'écran : le chrome (croix, titre, boutons), et la barre —
 *  qui reste seule pendant un défilement, comme la vue du défilement du
 *  grand lecteur. Hors lecture, le chrome ne s'estompe jamais, et la barre
 *  n'a rien à montrer. `chromeVisible` : l'état des contrôles. */
export function trailerChromeShown(state: TrailerState, chromeVisible: boolean, scrubbing: boolean): {
  chrome: boolean;
  timeline: boolean;
} {
  if (state !== "playing") return { chrome: true, timeline: false };
  return { chrome: chromeVisible && !scrubbing, timeline: chromeVisible || scrubbing };
}

/** L'écran rend la fiche de lui-même après ce délai, ou jamais (`null`) — seulement devant. */
export function trailerLeavesAfter(state: TrailerState, screenFocused: boolean): number | null {
  return state === "unavailable" && screenFocused ? TRAILER_UNAVAILABLE_RETURN_MS : null;
}

/** Ce que fait le chrome quand l'écran change d'état, de pause ou de panneau. */
export type TrailerChromeSync = "hide" | "reveal";

/**
 * Le chrome à chaque transition (`previous` : l'état d'avant, `null` à
 * l'ouverture). La PREMIÈRE image éteint le chrome : la vidéo commence nue,
 * comme le lecteur d'un film, et ne montre ses commandes qu'à un geste
 * (flèche, OK, pavé, Lecture/Pause). Le passage « chargement → lecture » les
 * rallumait jusqu'ici trois secondes — l'habillage paraissait par-dessus la
 * première image, puis s'estompait (lot 1017). Toute autre transition (pause,
 * panneau refermé, chargement) le rallume, comme avant.
 */
export function trailerChromeSync(previous: TrailerState | null, next: TrailerState): TrailerChromeSync {
  return next === "playing" && previous !== "playing" ? "hide" : "reveal";
}
