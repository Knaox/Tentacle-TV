import { forwardRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import { pressTransition } from "../../theme/motion";

interface PressableScaleProps extends HTMLMotionProps<"button"> {
  /** Grossissement au survol (1 = immobile). */
  hoverScale?: number;
  /** Compression à l'appui. */
  tapScale?: number;
}

/**
 * Le bouton qui RÉPOND — micro-interaction unifiée des contrôles cliquables (CTA, actions
 * rondes, flèches de carrousel) : il se presse à 97 % en 120 ms, DÈS l'appui (`whileTap` part
 * au pointeur enfoncé, pas au relâcher). Plus de grossissement au survol par défaut (refonte de
 * nov. 2026) : un appelant le demande par `hoverScale` — framer ignore le survol d'un doigt.
 * Le style visuel reste à la charge de l'appelant via `className`. Sous
 * `prefers-reduced-motion`, les échelles sont neutralisées.
 */
export const PressableScale = forwardRef<HTMLButtonElement, PressableScaleProps>(
  function PressableScale({ hoverScale = 1, tapScale = 0.97, ...props }, ref) {
    const reduced = useReducedMotion();
    return (
      <motion.button
        ref={ref}
        type="button"
        whileHover={reduced || hoverScale === 1 ? undefined : { scale: hoverScale }}
        whileTap={reduced ? undefined : { scale: tapScale }}
        transition={pressTransition}
        {...props}
      />
    );
  },
);
