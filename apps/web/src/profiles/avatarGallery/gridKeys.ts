/**
 * Les flèches dans la galerie : gauche et droite suivent l'ordre de lecture
 * (d'une collection à l'autre), haut et bas vont à la tuile la plus proche
 * horizontalement sur la rangée voisine, Début et Fin aux extrémités. Les
 * rangées se lisent sur la position des tuiles : la grille se replie selon la
 * largeur de la fenêtre, et ses sections n'ont pas toutes la même longueur.
 * Pur : rend l'index visé, ou `null` (touche sans effet, ou bord atteint).
 */

export interface TileBox {
  /** Haut de la tuile (px) : deux tuiles de même `top` sont sur la même rangée. */
  top: number;
  /** Centre horizontal (px). */
  center: number;
}

const SAME_ROW = 4;

export function nextTileIndex(boxes: readonly TileBox[], index: number, key: string): number | null {
  if (index < 0 || index >= boxes.length) return null;
  switch (key) {
    case "ArrowRight":
      return index + 1 < boxes.length ? index + 1 : null;
    case "ArrowLeft":
      return index > 0 ? index - 1 : null;
    case "Home":
      return index === 0 ? null : 0;
    case "End":
      return index === boxes.length - 1 ? null : boxes.length - 1;
    case "ArrowDown":
      return nearestInRow(boxes, index, 1);
    case "ArrowUp":
      return nearestInRow(boxes, index, -1);
    default:
      return null;
  }
}

/** La tuile la plus proche horizontalement sur la rangée suivante (1) ou précédente (-1). */
function nearestInRow(boxes: readonly TileBox[], index: number, direction: 1 | -1): number | null {
  const here = boxes[index];
  const rowTops = [...new Set(boxes.map((box) => Math.round(box.top)))].sort((a, b) => a - b);
  const candidates = rowTops.filter((top) => (direction === 1 ? top > here.top + SAME_ROW : top < here.top - SAME_ROW));
  if (candidates.length === 0) return null;
  const rowTop = direction === 1 ? candidates[0] : candidates[candidates.length - 1];
  let best: number | null = null;
  let bestDistance = Infinity;
  boxes.forEach((box, i) => {
    if (Math.abs(box.top - rowTop) > SAME_ROW) return;
    const distance = Math.abs(box.center - here.center);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
}
