import { motion, type Transition } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";
import { sceneSpring } from "./sceneMotion";

/** Position STATIQUE en px logiques (left/top/width/height — jamais animés). */
export interface Placed {
  x: number;
  y: number;
  w?: number;
  h?: number;
}

/** Les seules valeurs qui bougent : l'opacité et le transform. */
export interface Animated {
  visible?: boolean;
  dx?: number;
  dy?: number;
  scale?: number;
}

interface PlaceProps extends Placed, Animated {
  transition?: Transition;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * La brique de placement du kit : une boîte absolue posée en px logiques, dont
 * seuls l'opacité et le transform s'animent. `initial={false}` — un composant
 * du kit ne joue jamais d'entrée : il rend l'état du pas courant, et c'est le
 * changement de pas qui anime. Avec l'horloge clouée (mouvement réduit), rien
 * ne transitionne jamais.
 */
export function Place({
  x, y, w, h, visible = true, dx = 0, dy = 0, scale = 1, transition = sceneSpring, className, style, children,
}: PlaceProps) {
  return (
    <motion.div
      className={`absolute ${className ?? ""}`}
      style={{ left: x, top: y, width: w, height: h, ...style }}
      initial={false}
      animate={{ opacity: visible ? 1 : 0, x: dx, y: dy, scale }}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}
