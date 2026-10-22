/**
 * Le plein écran DEMANDÉ, tant que le compositeur n'a pas répondu — Linux.
 *
 * `setFullScreen` est asynchrone sous Wayland comme sous X11 : Chromium ne
 * change `isFullScreen()` qu'à l'acquittement du compositeur (le `configure`
 * Wayland, le `_NET_WM_STATE` X11), quelques dizaines à quelques centaines de
 * millisecondes plus tard. Entre les deux, la fenêtre MENT : un second clic
 * rapide sur le bouton refaisait le même geste au lieu de l'inverse, et la
 * touche Échap, la sortie du lecteur ou le retour du PiP lisaient l'état
 * d'avant.
 *
 * On retient donc la cible demandée, qui fait foi jusqu'au premier évènement
 * `enter-full-screen` / `leave-full-screen` — ou jusqu'à `INTENT_TTL_MS`, au
 * cas où le compositeur refuserait sans rien dire : on revient alors à ce que
 * dit la fenêtre, plutôt qu'à une promesse jamais tenue.
 *
 * Module pur : l'horloge est passée en argument.
 */

/** Au-delà, une demande restée sans réponse est tenue pour refusée. */
export const INTENT_TTL_MS = 1500;

export interface FullscreenIntent {
  readonly target: boolean;
  readonly at: number;
}

/** L'état à croire : la cible encore en vol, sinon celui de la fenêtre. */
export function effectiveFullscreen(
  intent: FullscreenIntent | null,
  actual: boolean,
  now: number,
): boolean {
  if (intent === null) return actual;
  if (now - intent.at > INTENT_TTL_MS) return actual;
  return intent.target;
}

/**
 * Un évènement du compositeur est arrivé : la demande est-elle soldée ?
 *
 * Seul l'évènement qui VA dans le sens demandé la solde. Le montage Wayland
 * forcé (`surfaceWayland.ts`) peut faire passer un `leave` suivi d'un `enter`
 * réaffirmé : le `leave` n'éteint pas une demande d'entrée.
 */
export function settleIntent(
  intent: FullscreenIntent | null,
  reached: boolean,
): FullscreenIntent | null {
  if (intent === null) return null;
  return intent.target === reached ? null : intent;
}
