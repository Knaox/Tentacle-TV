/**
 * Octave — la géométrie du glisser d'une rangée (hauteur FIXE, 56 px) : où
 * tombe la rangée tenue, de combien glissent les autres, à quelle vitesse la
 * page défile près d'un bord. Pur : seules des transformations en sortent
 * (jamais une remise en page pendant le geste).
 */

export const ROW_HEIGHT = 56;
/** Le geste ne commence qu'après quelques pixels : un clic sur la poignée ne déplace rien. */
export const DRAG_THRESHOLD_PX = 4;
/**
 * La bande, près d'un bord de la zone VISIBLE (sous les barres qui la recouvrent), où la page avance d'elle-même.
 * 30/10 : 64 px, mesurés sur toute la liste, tombaient SOUS la barre du haut du mobile — le défilement ne
 * partait qu'en y entrant, au plus lent.
 */
export const EDGE_PX = 88;
/** Vitesse au bord même (px/s), avant l'accélération ; et au seuil de la bande. */
export const EDGE_MAX_SPEED = 2400;
export const EDGE_MIN_SPEED = 90;
/** Tenu au bord, le défilement accélère jusqu'à ce facteur, atteint en `EDGE_ACCEL_MS`. */
export const EDGE_ACCEL = 1.8;
export const EDGE_ACCEL_MS = 1200;

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

/**
 * La vitesse du défilement automatique, en px PAR SECONDE (négative vers le haut) : nulle hors des bandes, de
 * `EDGE_MIN_SPEED` au seuil à `EDGE_MAX_SPEED` au bord (courbe au carré : fine près du seuil, franche au bord ;
 * un doigt AU-DELÀ du bord — sur une barre — vaut le bord), puis accélérée tant qu'on reste dans la bande
 * (`heldMs`). La règle ne dépend pas de la cadence : on la multiplie par la durée de l'image.
 */
export function edgeScrollVelocity(pointerY: number, top: number, bottom: number, heldMs = 0, edge = EDGE_PX): number {
  const room = Math.max(1, Math.min(edge, (bottom - top) / 3));
  let depth = 0;
  let sign = 0;
  if (pointerY < top + room) {
    depth = (top + room - pointerY) / room;
    sign = -1;
  } else if (pointerY > bottom - room) {
    depth = (pointerY - (bottom - room)) / room;
    sign = 1;
  }
  if (sign === 0) return 0;
  const p = Math.min(1, depth);
  const accel = 1 + (EDGE_ACCEL - 1) * Math.min(1, Math.max(0, heldMs) / EDGE_ACCEL_MS);
  return sign * (EDGE_MIN_SPEED + (EDGE_MAX_SPEED - EDGE_MIN_SPEED) * p * p) * accel;
}

/** Le pas d'une image : la vitesse × la durée de l'image (bornée : une image en retard ne fait pas un bond). */
export function edgeScrollStep(velocity: number, frameMs: number): number {
  return (velocity * Math.min(Math.max(frameMs, 0), 34)) / 1000;
}

/**
 * Les rangées à MONTER d'une liste virtualisée de rangées fixes : la fenêtre visible, arrondie à des paquets de
 * `block` rangées (elle ne change donc qu'au franchissement d'un paquet, jamais à chaque image), élargie de
 * `overscan` rangées de chaque côté. `listTop` : le haut des rangées dans le contenu qui défile.
 */
export function rowWindow(scroll: number, viewport: number, listTop: number, rowHeight: number, count: number, block = 8, overscan = 12): { first: number; last: number } {
  if (count <= 0) return { first: 0, last: -1 };
  const top = Math.floor(Math.max(0, scroll - listTop) / rowHeight);
  const bottom = Math.floor(Math.max(0, scroll + viewport - listTop) / rowHeight);
  const first = Math.max(0, Math.floor(top / block) * block - overscan);
  const last = Math.min(count - 1, (Math.floor(bottom / block) + 1) * block - 1 + overscan);
  return { first: Math.min(first, count - 1), last };
}
