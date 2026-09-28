import type { SwipeVerdict } from "./swipeTypes";

/**
 * La lecture d'un glisser de carte, commune au web (framer-motion) et au
 * mobile (PanResponder). L'axe qui DOMINE décide : horizontal → j'aime (droite)
 * ou pas pour moi (gauche) ; vertical → coup de cœur (haut) ou passer (bas).
 * Un like appuyé qui remonte un peu reste un like. Dans la direction choisie,
 * il faut aller assez loin OU lancer assez vite — et un lancer ne compte
 * qu'après un petit trajet, pour qu'un appui qui tressaille ne juge rien.
 * Le bas vaut « passer », exactement comme le bouton : c'est le verdict sans
 * poids (le titre revient plus tard) et il s'annule d'un geste.
 */
export const DISTANCE_THRESHOLD = 110;
/** px/s — un lancer franc vaut une longue course. */
export const VELOCITY_THRESHOLD = 650;
/** px — trajet minimal d'un lancer, dans sa direction. */
export const FLICK_MIN_DISTANCE = 20;
/** px — où un tampon commence à paraître ; il est plein au seuil de distance. */
export const STAMP_START = 24;

/** Assez loin, ou assez vite après un petit trajet — `along` et `speed`
 *  sont mesurés dans le sens du verdict (positifs quand on y va). */
function reached(along: number, speed: number): boolean {
  return along > DISTANCE_THRESHOLD || (speed > VELOCITY_THRESHOLD && along > FLICK_MIN_DISTANCE);
}

export function verdictFromDrag(dx: number, dy: number, vx: number, vy: number): SwipeVerdict | null {
  if (Math.abs(dy) > Math.abs(dx)) {
    if (reached(-dy, -vy)) return "superlike";
    if (reached(dy, vy)) return "skip";
    return null;
  }
  if (reached(dx, vx)) return "like";
  if (reached(-dx, -vx)) return "dislike";
  return null;
}

/**
 * L'intensité (0 → 1) du tampon d'un verdict pendant le glisser : nulle tant
 * que l'axe de ce verdict ne domine pas, pleine au seuil de distance. Un tampon
 * plein annonce donc exactement ce que le lâcher décidera (hors lancer).
 * Le mobile en garde une copie en worklet (`SwipeStampsNative`) : même règle.
 */
export function stampStrength(verdict: SwipeVerdict, dx: number, dy: number): number {
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const along =
    verdict === "like" ? (horizontal ? dx : 0)
    : verdict === "dislike" ? (horizontal ? -dx : 0)
    : verdict === "superlike" ? (horizontal ? 0 : -dy)
    : horizontal ? 0 : dy;
  return Math.min(1, Math.max(0, (along - STAMP_START) / (DISTANCE_THRESHOLD - STAMP_START)));
}

/**
 * Où part une carte jugée — hors de l'écran, dans la direction du verdict, en
 * gardant le décalage de l'autre axe au moment du lâcher : une carte jetée en
 * biais ne se recentre pas en partant.
 */
export function exitTarget(
  verdict: SwipeVerdict | null,
  width: number,
  from: { x: number; y: number } = { x: 0, y: 0 }
): { x: number; y: number } {
  const far = Math.max(width, 600) * 1.1;
  switch (verdict) {
    case "like":
      return { x: far, y: from.y + 40 };
    case "dislike":
      return { x: -far, y: from.y + 40 };
    case "superlike":
      return { x: from.x, y: -far };
    case "skip":
      return { x: from.x, y: far * 0.6 };
    default:
      return { x: 0, y: 0 };
  }
}
