import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { easeOut } from "../../theme/motion";
import { cursorTravel, instant, sceneSpring, sceneTween } from "./sceneMotion";

interface FauxCursorProps {
  /** La pointe, en px logiques. */
  x: number;
  y: number;
  /** Enfoncé : le pointeur se tasse et un anneau de clic part de la pointe. */
  pressed?: boolean;
  hidden?: boolean;
  reduced: boolean;
}

/**
 * Un pointeur qui se déplace et « clique ». Le voyage est un tween à durée
 * fixe ; l'anneau de clic est un calque monté à chaque front montant de
 * `pressed` (clé incrémentée), animé une fois, jamais en boucle. Sous mouvement
 * réduit : tout est instantané et l'anneau n'existe pas.
 */
export function FauxCursor({ x, y, pressed = false, hidden = false, reduced }: FauxCursorProps) {
  const [presses, setPresses] = useState(0);
  const wasPressed = useRef(false);
  useEffect(() => {
    if (pressed && !wasPressed.current) setPresses((n) => n + 1);
    wasPressed.current = pressed;
  }, [pressed]);

  const travel = reduced ? instant : cursorTravel;
  return (
    <motion.div
      className="absolute left-0 top-0 z-20"
      style={{ width: 0, height: 0 }}
      initial={false}
      animate={{ x, y, opacity: hidden ? 0 : 1, scale: pressed ? 0.85 : 1 }}
      transition={{ x: travel, y: travel, opacity: reduced ? instant : sceneTween, scale: reduced ? instant : sceneSpring }}
    >
      {!reduced && presses > 0 && (
        <motion.span
          key={presses}
          className="absolute -left-3 -top-3 h-6 w-6 rounded-full border-2 border-[var(--brand-accent)]"
          initial={{ opacity: 0.7, scale: 0.35 }}
          animate={{ opacity: 0, scale: 1.8 }}
          transition={{ duration: 0.5, ease: easeOut }}
        />
      )}
      {/* Un curseur système : blanc bordé de noir, comme partout — c'est un dessin, pas du chrome. */}
      <svg viewBox="0 0 20 24" className="absolute left-0 top-0 h-6 w-5">
        <path
          d="M2 1.5v17l4.6-4.1 2.9 6.6 3.4-1.5-2.9-6.5h6.1z"
          fill="#ffffff"
          stroke="#111111"
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </svg>
    </motion.div>
  );
}
