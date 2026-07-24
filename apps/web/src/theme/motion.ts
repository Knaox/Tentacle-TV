import type { Variants, Transition } from "framer-motion";

const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
};

export const easeOut = [0.22, 1, 0.36, 1] as const;
export const easeInOut = [0.65, 0, 0.35, 1] as const;

/** Ressort « press » — réponse vive des contrôles (hover/tap), ~180 ms perçus. */
export const springPress: Transition = { type: "spring", stiffness: 420, damping: 28, mass: 0.6 };
/** Ressort doux — éléments partagés (pastille de nav), sans rebond marqué. */
export const springSoft: Transition = { type: "spring", stiffness: 320, damping: 32 };

/**
 * Échelle de durées, en secondes.
 *
 * Bornes tenues : 150–300 ms pour une micro-interaction, 400 ms au maximum pour
 * une transition composée, jamais au-delà de 500 ms — passé ce seuil le
 * mouvement n'accompagne plus le geste, il le fait attendre. `page` est descendu
 * de 600 à 400 ms pour cette raison.
 */
export const duration = {
  fast: 0.15,
  base: 0.22,
  slow: 0.32,
  page: 0.4,
} as const;

/**
 * Sortie plus courte que l'entrée (≈65 %) : une surface qui s'efface n'a plus
 * rien à raconter, la traîner donne l'impression que l'interface met du temps à
 * répondre.
 */
export const exitDuration = (enter: number): number => enter * 0.65;

/**
 * Révélation de texte. `y: 10` et non 20 : au-delà d'une dizaine de pixels le
 * texte ne « se pose » plus, il glisse — et sur une cascade de cinq lignes les
 * glissements se voient les uns après les autres. C'est aussi une ligne de base
 * commune à la bannière, à la fiche média et à l'en-tête de bibliothèque, qui
 * avaient chacune leur amplitude.
 */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: duration.base, ease: easeOut } },
};

/**
 * Cascade de texte : décalage de 40 ms par ligne, dans la fourchette 30–50 ms
 * qui laisse percevoir l'ordre sans donner l'impression d'attendre la dernière.
 */
export const textStagger = (delayChildren = 0.04): Variants => ({
  show: { transition: { delayChildren, staggerChildren: 0.04 } },
});

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: duration.base, ease: easeOut } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: duration.base, ease: easeOut } },
};

export const stagger = (delayChildren = 0.1, staggerChildren = 0.06): Variants => ({
  show: { transition: { delayChildren, staggerChildren } },
});

export const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: duration.base, ease: easeOut } },
  exit: { opacity: 0, transition: { duration: exitDuration(duration.base), ease: easeOut } },
};

export const respectReducedMotion = <T extends Transition>(t: T): T | { duration: 0 } => {
  return prefersReducedMotion() ? { duration: 0 } : t;
};

export const noMotion = prefersReducedMotion;
