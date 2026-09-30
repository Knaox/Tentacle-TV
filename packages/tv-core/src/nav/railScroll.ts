/**
 * Le DÉFILEMENT du rail : la liste des entrées, entre un en-tête et un pied
 * fixes, quand elles sont plus nombreuses que la hauteur de l'écran ne le
 * permet (vingt bibliothèques et plus).
 *
 * La règle, celle d'une liste pilotée au pavé : l'entrée focalisée est
 * toujours ENTIÈRE et lisible, jamais au ras du bord — il reste au-delà
 * d'elle au moins une voisine entière (`comfort`), estompée, qui dit « il y en
 * a d'autres » et que le moteur de focus voit déjà quand on appuie. La liste
 * ne bouge que ce qu'il faut : tant que l'entrée visée est dans la zone de
 * confort, rien ne défile.
 *
 * Module pur : la géométrie arrive en argument (points, repère du contenu).
 */

export interface RailScrollGeometry {
  /** Hauteur visible de la liste. */
  viewport: number;
  /** Hauteur d'une entrée. */
  item: number;
  /** D'une entrée à la suivante (hauteur + écart). */
  pitch: number;
  /** Marges intérieures du contenu, en haut et en bas. */
  padTop: number;
  padBottom: number;
  /** Distance minimale entre l'entrée visée et le bord de la liste. */
  comfort: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** La hauteur du contenu pour `count` entrées. */
export function railContentHeight(count: number, geometry: RailScrollGeometry): number {
  const { padTop, padBottom, pitch, item } = geometry;
  return count > 0 ? padTop + (count - 1) * pitch + item + padBottom : padTop + padBottom;
}

/** Le défilement maximal ; 0 quand tout tient. */
export function railMaxOffset(count: number, geometry: RailScrollGeometry): number {
  return Math.max(0, railContentHeight(count, geometry) - geometry.viewport);
}

/** Le haut de l'entrée `index`, dans le repère du contenu. */
export function railItemTop(index: number, geometry: RailScrollGeometry): number {
  return geometry.padTop + index * geometry.pitch;
}

/**
 * Le défilement qui met l'entrée `index` dans la zone de confort, en bougeant
 * le moins possible depuis `offset` : descendre jusqu'à ce que son bas soit à
 * `comfort` du bord bas, ou remonter jusqu'à ce que son haut soit à `comfort`
 * du bord haut. Borné au contenu — la première entrée amène la liste en haut,
 * la dernière en bas. Un index hors liste ne fait que borner `offset`.
 */
export function railRevealOffset(index: number, offset: number, count: number, geometry: RailScrollGeometry): number {
  const max = railMaxOffset(count, geometry);
  if (index < 0 || index >= count) return clamp(offset, 0, max);
  const top = railItemTop(index, geometry);
  const bottom = top + geometry.item;
  let next = offset;
  if (top - next < geometry.comfort) next = top - geometry.comfort;
  else if (bottom - next > geometry.viewport - geometry.comfort) next = bottom - geometry.viewport + geometry.comfort;
  return clamp(next, 0, max);
}

/**
 * Le curseur de l'indicateur de position, sur une piste de `track` points :
 * sa taille (proportionnelle à la part visible, jamais sous `minSize`) et sa
 * course. `null` quand tout tient : pas d'indicateur.
 */
export function railThumb(
  count: number,
  geometry: RailScrollGeometry,
  track: number,
  minSize = 36,
): { size: number; travel: number } | null {
  const content = railContentHeight(count, geometry);
  if (content <= geometry.viewport) return null;
  const size = clamp(Math.round((track * geometry.viewport) / content), Math.min(minSize, track), track);
  return { size, travel: track - size };
}
