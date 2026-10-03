import type { RemoteIntent } from "../remote/intents";

/**
 * L'écran de BANDE-ANNONCE d'un téléviseur — une lecture plein écran sans
 * habillage : une croix Retour, seule action, et un titre. Module pur : la
 * plateforme compte le temps, pose le focus, recule.
 *
 * - La croix est l'entrée, et le reste : rien d'autre n'est focalisable (BA-1).
 * - Le chrome (la croix, le titre) s'estompe `TRAILER_IDLE_MS` après le début
 *   de la LECTURE, sans geste ; le moindre geste le rallume et relance
 *   l'attente. Rien ne s'estompe pendant le chargement ni sur « indisponible »
 *   (BA-2). La croix garde le focus tout du long : elle ne peut donc pas être
 *   le signal — c'est la télécommande qui l'est, Retour excepté (il quitte).
 * - « Indisponible » rend la fiche d'elle-même après
 *   `TRAILER_UNAVAILABLE_RETURN_MS`, le temps de lire la phrase (BA-3).
 */

/** La croix Retour : l'entrée, et la seule cible. */
export const TRAILER_CLOSE_KEY = "trailer:close";

/** Le délai sans geste au bout duquel le chrome s'estompe, en lecture. */
export const TRAILER_IDLE_MS = 3000;

/** Le temps de lire « indisponible » avant de rendre la fiche. */
export const TRAILER_UNAVAILABLE_RETURN_MS = 4000;

export type TrailerState = "loading" | "playing" | "unavailable";

/** Ce que montre l'écran : rien à lire (ou un échec), la lecture, ou le chargement. */
export function trailerState(state: { canPlay: boolean; failed: boolean; loaded: boolean }): TrailerState {
  if (!state.canPlay || state.failed) return "unavailable";
  return state.loaded ? "playing" : "loading";
}

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
