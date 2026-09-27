import type { SwipeVerdict } from "./swipeTypes";

/**
 * La lecture d'un glisser de carte, commune au web (framer-motion) et au
 * mobile (PanResponder) : assez loin OU assez vite dans une
 * direction nette. Le haut (coup de cœur) exige que le mouvement vertical
 * domine — un like appuyé qui remonte un peu reste un like. Le bas n'est pas
 * un geste : « passer » ne se fait qu'au bouton ou au clavier, pour qu'un
 * défilement raté ne juge jamais rien.
 */
export const DISTANCE_THRESHOLD = 110;
/** px/s — un lancer franc vaut une longue course. */
export const VELOCITY_THRESHOLD = 650;

export function verdictFromDrag(dx: number, dy: number, vx: number, vy: number): SwipeVerdict | null {
  const up = -dy;
  const vUp = -vy;
  if (up > Math.abs(dx) && (up > DISTANCE_THRESHOLD || vUp > VELOCITY_THRESHOLD)) return "superlike";
  if (Math.abs(dx) >= up) {
    if (dx > DISTANCE_THRESHOLD || (vx > VELOCITY_THRESHOLD && dx > 20)) return "like";
    if (dx < -DISTANCE_THRESHOLD || (vx < -VELOCITY_THRESHOLD && dx < -20)) return "dislike";
  }
  return null;
}

/** Où part une carte jugée — hors de l'écran, dans la direction du geste. */
export function exitTarget(verdict: SwipeVerdict | null, width: number): { x: number; y: number } {
  const far = Math.max(width, 600) * 1.1;
  switch (verdict) {
    case "like":
      return { x: far, y: 40 };
    case "dislike":
      return { x: -far, y: 40 };
    case "superlike":
      return { x: 0, y: -far };
    case "skip":
      return { x: 0, y: far * 0.6 };
    default:
      return { x: 0, y: 0 };
  }
}
