import { forwardRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import { springPress } from "../../theme/motion";

interface PressableScaleProps extends HTMLMotionProps<"button"> {
  /** Grossissement au survol (1 = immobile). */
  hoverScale?: number;
  /** Compression à l'appui. */
  tapScale?: number;
}

/**
 * Bouton à ressort — micro-interaction unifiée des contrôles cliquables (CTA,
 * actions rondes, flèches de carrousel) : léger grossissement au survol,
 * compression à l'appui, ressort interruptible (`springPress`). Le style
 * visuel (fond, bordure, typographie) reste à la charge de l'appelant via
 * `className`. Sous `prefers-reduced-motion`, les échelles sont neutralisées.
 */
export const PressableScale = forwardRef<HTMLButtonElement, PressableScaleProps>(
  function PressableScale({ hoverScale = 1.03, tapScale = 0.96, ...props }, ref) {
    const reduced = useReducedMotion();
    return (
      <motion.button
        ref={ref}
        type="button"
        whileHover={reduced ? undefined : { scale: hoverScale }}
        whileTap={reduced ? undefined : { scale: tapScale }}
        transition={springPress}
        {...props}
      />
    );
  },
);
