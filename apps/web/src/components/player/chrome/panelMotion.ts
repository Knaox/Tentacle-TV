import { duration, easeOut } from "../../../theme/motion";

/**
 * Le mouvement d'un panneau détaché du lecteur (pistes, vitesse, épisodes) : un MENU — il sort
 * de sa capsule en 180 ms depuis 96 % (jamais depuis rien), et y retourne en 120 ms. L'origine
 * de l'échelle est posée par `.pl-panel` (en bas à droite, là où est son bouton).
 */
export const PANEL_MOTION = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: { duration: duration.menuIn, ease: easeOut } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: duration.menuOut, ease: easeOut } },
} as const;
