import type { Variants } from "framer-motion";
import { duration, easeIn, easeOut, exitDuration } from "../../theme/motion";
import { springToFramer, type GlassSpring } from "../../theme/glass/springs";

/**
 * Le mouvement des panneaux flottants (menus, popovers), selon le mode.
 *
 * - Hors verre : le fondu et l'échelle d'avant, à l'identique.
 * - Verre natif (macOS 26) : le menu NAÎT de son déclencheur — échelle depuis
 *   l'origine que pose le placement (`transformOrigin`), sur un ressort court
 *   presque sans rebond, comme un menu de Tahoe ; il repart plus vite qu'il
 *   n'est venu (≈ 65 %, `exitDuration`), sans ressort.
 * - Mouvement réduit (verre natif) : un fondu seul, aucune échelle.
 *
 * Rien que `opacity` et `transform` : la couche du verre est composée, son flou
 * ne se recalcule pas à chaque image d'une mise en page.
 */

/** Le ressort de l'ouverture : ~300 ms perçus, un soupçon de dépassement (< 1 %). */
export const MENU_OPEN_SPRING: GlassSpring = { response: 0.3, dampingFraction: 0.86 };

/** L'échelle de départ d'un menu en verre : il sort du bouton, pas de nulle part. */
export const MENU_FROM_SCALE = 0.9;

const LEGACY: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: duration.fast, ease: easeOut } },
  exit: { opacity: 0, scale: 0.97, transition: { duration: exitDuration(duration.fast), ease: easeIn } },
};

const GLASS: Variants = {
  hidden: { opacity: 0, scale: MENU_FROM_SCALE },
  show: {
    opacity: 1,
    scale: 1,
    transition: { scale: springToFramer(MENU_OPEN_SPRING), opacity: { duration: duration.fast * 0.8, ease: easeOut } },
  },
  exit: { opacity: 0, scale: 0.96, transition: { duration: exitDuration(duration.fast), ease: easeIn } },
};

const GLASS_REDUCED: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: duration.fast, ease: easeOut } },
  exit: { opacity: 0, transition: { duration: exitDuration(duration.fast), ease: easeIn } },
};

export function floatingVariants(nativeGlass: boolean, reducedMotion: boolean): Variants {
  if (!nativeGlass) return LEGACY;
  return reducedMotion ? GLASS_REDUCED : GLASS;
}
