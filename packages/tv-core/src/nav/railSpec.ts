/**
 * La géométrie du rail, en points.
 *
 * Relevée sur la feuille de la LG (`styles/rail-tv.css`), où ces mêmes nombres
 * sont écrits en pixels sur un canevas fixe de 1920 × 1080 — donc directement
 * transposables en points React Native, qui travaille sur le même canevas
 * logique sur une dalle 4K.
 *
 * Le rail ne change JAMAIS de largeur. C'est le point qui a demandé le plus de
 * soin : la version native animait sa largeur de 76 à 256 points, ce qui
 * repoussait toutes les affiches à chaque fois que le focus entrait dans le
 * menu. Ici, seul un panneau posé DERRIÈRE le rail apparaît en fondu ; les
 * icônes ne bougent pas d'un point, et le contenu de la page non plus.
 *
 * Corollaire important pour le focus : le moteur de navigation vient de
 * calculer sa géométrie sur ces positions. Si elles bougeaient pendant la
 * transition, il viserait des cases qui ne sont plus là.
 */
export const RAIL = {
  /** Largeur du rail lui-même, hors retrait d'overscan. Constante. */
  collapsedWidth: 90,
  /** Largeur du panneau qui apparaît derrière, en fondu d'opacité seul. */
  panelWidth: 460,
  /** Durée du fondu du panneau et des libellés. */
  duration: 220,

  /** Hauteur d'une entrée, et plancher quand la liste doit se comprimer.
   *
   * Le rail ne défile pas : poser `overflow-y` forcerait aussi l'axe
   * horizontal, ce qui rognerait les libellés qui débordent volontairement du
   * rail replié. Les entrées se compriment donc jusqu'à ce plancher. */
  itemHeight: 64,
  itemMinHeight: 44,
  itemGap: 8,

  /** Retrait interne d'une entrée, et largeur de la case d'icône. */
  itemInset: 12,
  iconWidth: 44,

  /** Le libellé est posé en absolu : il déborde du rail replié sans élargir
   *  l'entrée, et sa place est réservée dans les deux états. */
  labelLeft: 72,
  labelOffset: 12,

  /** Réserve haute pour la marque, basse pour l'indice d'usage. */
  topReserve: 56,
  bottomReserve: 44,

  brandHeight: 56,
  brandGap: 14,
} as const;

/** Largeur d'une entrée quand le panneau est déployé. Le libellé tient dedans
 *  sans atteindre le bord estompé du panneau. */
export const expandedItemWidth = (overscanX: number): number =>
  RAIL.panelWidth - overscanX - 64;

/** Largeur de l'indice d'usage, en bas du panneau déployé. */
export const railHintWidth = (overscanX: number): number =>
  RAIL.panelWidth - overscanX - 20;

/** Borne droite des entrées déployées. Le pont de sortie du rail (tvOS) doit
 *  se poser AU-DELÀ : posé à la largeur repliée, sa bande chevauchait les
 *  entrées déployées et le moteur de focus lui détournait des HAUT/BAS. */
export const expandedItemsRightEdge = (overscanX: number): number =>
  overscanX + expandedItemWidth(overscanX);
