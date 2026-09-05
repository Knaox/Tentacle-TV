import type { Transition } from "framer-motion";
import { easeOut, springSoft } from "../../theme/motion";

/**
 * Le canevas LOGIQUE des scènes : chaque scène s'écrit en px de cette surface,
 * que SceneStage met à l'échelle en `transform` selon sa largeur réelle. Les
 * coordonnées sont donc exactes et identiques à toutes les tailles de modale.
 */
export const STAGE_W = 640;
export const STAGE_H = 360;

/** Ressort des déplacements et des levées. */
export const sceneSpring: Transition = springSoft;
/** Tween des apparitions et des fondus. */
export const sceneTween: Transition = { duration: 0.45, ease: easeOut };
/** Le curseur voyage à durée fixe : un pointeur ne rebondit pas. */
export const cursorTravel: Transition = { duration: 0.55, ease: [0.45, 0.05, 0.25, 1] };
/** Mouvement réduit : aucune transition, l'état final tout de suite. */
export const instant: Transition = { duration: 0 };
