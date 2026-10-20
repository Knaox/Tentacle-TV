/**
 * L'image dans l'image — quand y entrer d'elle-même, et quand proposer le
 * bouton. Une seule règle pour iOS et Android.
 *
 * iOS (AVKit) n'ouvre la petite fenêtre en quittant l'app QUE pour une lecture
 * qui avance : une vidéo en pause reste en pause dans l'app. Android suit la
 * même règle : `setAutoEnterEnabled` (Android 12+) ou `onUserLeaveHint`
 * (avant) ne sont armés que pendant une lecture.
 *
 * Jamais quand l'image n'est pas sur ce téléphone (AirPlay, diffusion vers une
 * TV) ni avant la première image, ni sur un écran de fin ou d'erreur.
 */
export interface PipState {
  paused: boolean;
  /** La lecture a avancé au moins une fois (première image affichée). */
  started: boolean;
  /** Le flux est allé au bout (écran de fin). */
  ended: boolean;
  /** Un message d'erreur occupe l'écran. */
  failed: boolean;
  /** L'image est ailleurs : AirPlay, Google Cast. */
  remote: boolean;
}

/** Entrer d'elle-même en image dans l'image en quittant l'app ? */
export function shouldAutoEnterPip(state: PipState): boolean {
  return canOfferPip(state) && !state.paused;
}

/** Le bouton « Image dans l'image » : une image locale à montrer, en pause comprise. */
export function canOfferPip(state: PipState): boolean {
  return state.started && !state.ended && !state.failed && !state.remote;
}

/** Les gestes de la petite fenêtre Android (iOS a les siens, ceux d'AVKit). */
export type PipAction = "play" | "pause" | "rewind" | "forward";

/** Les sauts des boutons de la petite fenêtre — les mêmes que ceux d'AVKit. */
export const PIP_SKIP_SECONDS = 10;

/** Le pas de saut d'une action, en secondes (0 : pas un saut). */
export function pipSkipDelta(action: PipAction): number {
  if (action === "rewind") return -PIP_SKIP_SECONDS;
  if (action === "forward") return PIP_SKIP_SECONDS;
  return 0;
}

/**
 * Le format de la petite fenêtre : celui de l'image, borné à ce qu'Android
 * accepte (entre 1:2,39 et 2,39:1, sinon `IllegalArgumentException`) ; 16:9
 * tant que l'image est inconnue.
 */
export function pipAspect(width?: number, height?: number): { width: number; height: number } {
  if (!width || !height || width <= 0 || height <= 0) return { width: 16, height: 9 };
  const max = 2.39;
  const ratio = width / height;
  if (ratio > max) return { width: 239, height: 100 };
  if (ratio < 1 / max) return { width: 100, height: 239 };
  return { width: Math.round(width), height: Math.round(height) };
}
