/**
 * Le repère qui GLISSE d'une option à l'autre — la pastille de l'onglet courant, celle d'un
 * choix segmenté. La règle, pure ; `SlidingMarker` la joue.
 *
 * Chaque option retenue porte SON repère (posé en `inset-0`, donc à sa taille) : changer
 * d'option démonte l'un et monte l'autre. Le nouveau part de là où était l'ancien — une
 * translation et une échelle, en `transform`, par l'API d'animation du navigateur : sur le
 * compositeur. Framer le faisait par `layoutId`, qui mesure et projette sur le fil principal à
 * chaque image, à l'instant précis où la page suivante s'y rend (l'onglet de la barre) ou où
 * la grille se refait (un filtre de bibliothèque).
 */

export interface MarkerBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Le glissement : ce qui se DÉPLACE à l'écran prend la courbe de déplacement du socle. */
export const MARKER_SLIDE_MS = 220;
export const MARKER_SLIDE_EASING = "cubic-bezier(0.77, 0, 0.175, 1)";
/** Un repère démonté il y a plus longtemps n'est pas celui d'où l'on vient : le nouveau se pose sans glisser. */
export const MARKER_HANDOFF_MS = 250;

/** La transformation qui pose la boîte `to` exactement sur `from` (origine en haut à gauche). */
export function slideFromTransform(from: MarkerBox, to: MarkerBox): string {
  return `translate3d(${from.left - to.left}px, ${from.top - to.top}px, 0) scale(${from.width / to.width}, ${from.height / to.height})`;
}

/** Moins d'un pixel d'écart, de position comme de taille : rien à faire glisser. */
export function sameBox(a: MarkerBox, b: MarkerBox): boolean {
  return Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;
}

const lastBoxes = new Map<string, { box: MarkerBox; at: number }>();

/** Le repère du groupe s'en va : où il était, transformation en cours comprise. */
export function rememberMarker(group: string, box: MarkerBox, at: number): void {
  lastBoxes.set(group, { box, at });
}

/** D'où part le repère qui se monte ; `null` : il se pose sans glisser. */
export function markerOrigin(group: string, to: MarkerBox, at: number): MarkerBox | null {
  const previous = lastBoxes.get(group);
  if (!previous || at - previous.at > MARKER_HANDOFF_MS) return null;
  if (to.width < 1 || to.height < 1 || sameBox(previous.box, to)) return null;
  return previous.box;
}

/** Pour les tests. */
export function resetSlidingMarkersForTests(): void {
  lastBoxes.clear();
}
