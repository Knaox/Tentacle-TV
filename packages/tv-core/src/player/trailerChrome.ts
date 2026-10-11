import type { RemoteIntent } from "../remote/intents";

/**
 * L'écran de BANDE-ANNONCE d'un téléviseur — un lecteur ULTRA simplifié :
 * avancer / reculer, la pause, et (si le serveur sait les servir) les
 * sous-titres et la qualité. Rien d'autre. Module pur : la plateforme compte
 * le temps, pose le focus, recule.
 *
 * - Les cibles, l'entrée et les voisins : `trailerFocus.ts` ; les contrôles
 *   (ceux du grand lecteur) : `trailerControls.ts` ; le Retour :
 *   `trailerBack.ts` ; les panneaux : `trailerPanels.ts`.
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

// L'attente d'AVANT le lecteur simplifié (une croix, aucun contrôle), que
// l'applicateur `platform/tvos/screens/trailer.ts` lit encore : remplacée par
// `createTrailerControls`, elle part avec lui (BA-T3).

/** Un geste de la télécommande rallume le chrome — tout, sauf Retour, qui quitte l'écran. */
export function trailerWakes(intent: RemoteIntent): boolean {
  return intent.type !== "retour";
}

/** Le chrome après un évènement, et ce que devient l'attente de l'estompage. */
export interface TrailerChromeStep {
  dimmed: boolean;
  /** `arm` : relancer l'attente ; `cancel` : l'arrêter ; `keep` : n'y rien changer. */
  timer: "arm" | "cancel" | "keep";
}

/** La lecture commence ou s'arrête : le chrome se rallume ; l'attente ne court qu'en lecture. */
export function trailerChromeOnPlaying(playing: boolean): TrailerChromeStep {
  return { dimmed: false, timer: playing ? "arm" : "cancel" };
}

/** Un geste : le chrome se rallume ; en lecture, l'attente repart. */
export function trailerChromeOnWake(playing: boolean): TrailerChromeStep {
  return { dimmed: false, timer: playing ? "arm" : "keep" };
}

/** L'attente est écoulée : le chrome s'estompe. */
export const TRAILER_CHROME_ON_IDLE: TrailerChromeStep = { dimmed: true, timer: "keep" };

/** L'écran rend la fiche de lui-même après ce délai, ou jamais (`null`) — seulement devant. */
export function trailerLeavesAfter(state: TrailerState, screenFocused: boolean): number | null {
  return state === "unavailable" && screenFocused ? TRAILER_UNAVAILABLE_RETURN_MS : null;
}
