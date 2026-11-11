import type { TargetAndTransition, Variants } from "framer-motion";
import { duration, easeOut, exitDuration } from "../../theme/motion";
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

/**
 * Fermé au CLAVIER (Échap, Entrée sur une entrée) : le panneau part d'un coup — une touche ne
 * s'anime pas. `custom` d'`AnimatePresence` le dit à la sortie ; l'ouverture au clavier, elle,
 * se passe d'état de départ (`initial={false}`, cf. `FloatingLayer`).
 */
export const INSTANT_EXIT: TargetAndTransition = { opacity: 0, transition: { duration: 0 } };
/** Une sortie qui part d'un coup quand le geste vient du clavier (`custom` d'`AnimatePresence`). */
export const exitOr = (exit: TargetAndTransition) => (keyboard?: boolean): TargetAndTransition => (keyboard ? INSTANT_EXIT : exit);

// Hors du verre natif (refonte de nov. 2026) : le menu SORT de son bouton — l'échelle part de
// l'origine que pose le placement —, 180 ms à l'entrée, 120 à la sortie, la même courbe.
// `transform` ENTIER, jamais `scale` seul : framer 11 ne confie au compositeur que celui-là, et
// un menu s'ouvre pendant que son contenu se monte sur le fil principal.
const LEGACY: Variants = {
  hidden: { opacity: 0, transform: "scale(0.96)" },
  show: { opacity: 1, transform: "scale(1)", transition: { duration: duration.menuIn, ease: easeOut } },
  exit: exitOr({ opacity: 0, transform: "scale(0.96)", transition: { duration: duration.menuOut, ease: easeOut } }),
};

const GLASS: Variants = {
  hidden: { opacity: 0, scale: MENU_FROM_SCALE },
  show: {
    opacity: 1,
    scale: 1,
    transition: { scale: springToFramer(MENU_OPEN_SPRING), opacity: { duration: duration.fast * 0.8, ease: easeOut } },
  },
  exit: exitOr({ opacity: 0, scale: 0.96, transition: { duration: exitDuration(duration.fast), ease: easeOut } }),
};

const GLASS_REDUCED: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: duration.fast, ease: easeOut } },
  exit: exitOr({ opacity: 0, transition: { duration: exitDuration(duration.fast), ease: easeOut } }),
};

/** Mouvement réduit, hors verre : le fondu seul — plus d'échelle. */
const LEGACY_REDUCED: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: duration.menuOut, ease: easeOut } },
  exit: exitOr({ opacity: 0, transition: { duration: duration.menuOut, ease: easeOut } }),
};

export function floatingVariants(nativeGlass: boolean, reducedMotion: boolean): Variants {
  if (!nativeGlass) return reducedMotion ? LEGACY_REDUCED : LEGACY;
  return reducedMotion ? GLASS_REDUCED : GLASS;
}

/**
 * Le mouvement réduit du système, tel que l'accessibilité du verre le pose sur
 * `<html>` (`data-lg-motion`, `installGlassAccessibility`, suivi en direct) —
 * lu au rendu, sans crochet : celui de framer-motion porte sa propre copie de
 * React, que le rendu statique des tests ne connaît pas.
 */
export function glassMotionReduced(root: { dataset?: DOMStringMap } | undefined = globalThis.document?.documentElement): boolean {
  return root?.dataset?.lgMotion === "reduce";
}
