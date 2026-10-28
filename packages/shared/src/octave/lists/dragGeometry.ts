/**
 * Octave — la géométrie du glisser d'une rangée (hauteur FIXE, 56 px) : où
 * tombe la rangée tenue, de combien glissent les autres, à quelle vitesse la
 * page défile près d'un bord. Pur : seules des transformations en sortent
 * (jamais une remise en page pendant le geste).
 */

export const ROW_HEIGHT = 56;
/** Le geste ne commence qu'après quelques pixels : un clic sur la poignée ne déplace rien. */
export const DRAG_THRESHOLD_PX = 4;
/** La bande, près d'un bord de la zone qui défile, où la page avance d'elle-même. */
export const EDGE_PX = 64;
const MAX_SPEED_PX = 18;

/** La place visée : le rang de départ plus le déplacement en rangées entières, borné à la liste. */
export function dragTarget(from: number, deltaPx: number, count: number, rowHeight = ROW_HEIGHT): number {
  return Math.max(0, Math.min(count - 1, from + Math.round(deltaPx / rowHeight)));
}

/** Le décalage d'une AUTRE rangée pendant le geste : elle s'écarte pour faire place. */
export function rowShift(index: number, from: number, over: number, rowHeight = ROW_HEIGHT): number {
  if (index === from) return 0;
  if (from < over && index > from && index <= over) return -rowHeight;
  if (from > over && index >= over && index < from) return rowHeight;
  return 0;
}

/** La vitesse du défilement automatique (px par image) : nulle hors des bords, croissante vers eux. */
export function edgeScrollSpeed(pointerY: number, top: number, bottom: number, edge = EDGE_PX): number {
  if (pointerY < top + edge) return -Math.ceil(MAX_SPEED_PX * Math.min(1, (top + edge - pointerY) / edge));
  if (pointerY > bottom - edge) return Math.ceil(MAX_SPEED_PX * Math.min(1, (pointerY - (bottom - edge)) / edge));
  return 0;
}
