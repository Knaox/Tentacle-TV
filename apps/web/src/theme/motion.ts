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

export const duration = {
  fast: 0.15,
  base: 0.24,
  slow: 0.4,
  page: 0.6,
} as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: duration.base, ease: easeOut } },
};

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
  animate: { opacity: 1, transition: { duration: duration.slow, ease: easeOut } },
  exit: { opacity: 0, transition: { duration: duration.fast, ease: easeOut } },
};

export const respectReducedMotion = <T extends Transition>(t: T): T | { duration: 0 } => {
  return prefersReducedMotion() ? { duration: 0 } : t;
};

export const noMotion = prefersReducedMotion;
