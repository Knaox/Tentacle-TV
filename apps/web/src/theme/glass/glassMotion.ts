/**
 * Les ressorts du verre côté framer-motion, et la métamorphose d'une forme
 * en une autre (une barre qui naît d'un bouton, un menu qui sort d'une
 * capsule) — l'équivalent de `glassEffectID` + `@Namespace` de SwiftUI.
 *
 * La métamorphose passe par `layoutId` : framer pose la nouvelle forme à sa
 * place, la fait paraître à la place de l'ancienne (FLIP, cf. `fusion.ts`),
 * puis la ramène à l'identité par `transform` — en corrigeant le rayon des
 * coins pendant l'étirement, pourvu que `borderRadius` soit passé en `style`.
 *
 * Mouvement réduit : plus de trajet, un fondu court (`settle` critique).
 */

import type { Transition } from "framer-motion";

import { GLASS_SPRINGS, springToFramer } from "./springs";

export const GLASS_FRAMER = {
  lens: springToFramer(GLASS_SPRINGS.lens),
  morph: springToFramer(GLASS_SPRINGS.morph),
  settle: springToFramer(GLASS_SPRINGS.settle),
} as const;

/** Fondu qui remplace la métamorphose quand le système demande moins de mouvement. */
export const GLASS_MORPH_REDUCED: Transition = { duration: 0.15, ease: "easeOut" };

export interface GlassMorphProps {
  layoutId: string;
  transition: Transition;
}

/**
 * Props à poser sur les DEUX formes d'une métamorphose (même `id`), dans un
 * même `LayoutGroup` si elles vivent dans des sous-arbres différents.
 * `reducedMotion` : la valeur de `useReducedMotion()` de framer.
 */
export function glassMorphProps(id: string, reducedMotion: boolean | null): GlassMorphProps {
  return {
    layoutId: `lg-morph-${id}`,
    transition: reducedMotion ? GLASS_MORPH_REDUCED : { layout: GLASS_FRAMER.morph, ...GLASS_FRAMER.settle },
  };
}
