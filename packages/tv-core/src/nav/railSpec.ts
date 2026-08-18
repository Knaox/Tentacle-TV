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
  largeurRepli: 90,
  /** Largeur du panneau qui apparaît derrière, en fondu d'opacité seul. */
  largeurPanneau: 460,
  /** Durée du fondu du panneau et des libellés. */
  duree: 220,

  /** Hauteur d'une entrée, et plancher quand la liste doit se comprimer.
   *
   * Le rail ne défile pas : poser `overflow-y` forcerait aussi l'axe
   * horizontal, ce qui rognerait les libellés qui débordent volontairement du
   * rail replié. Les entrées se compriment donc jusqu'à ce plancher. */
  hauteurEntree: 64,
  hauteurEntreeMin: 44,
  ecartEntrees: 8,

  /** Retrait interne d'une entrée, et largeur de la case d'icône. */
  retraitEntree: 12,
  largeurIcone: 44,

  /** Le libellé est posé en absolu : il déborde du rail replié sans élargir
   *  l'entrée, et sa place est réservée dans les deux états. */
  libelleGauche: 72,
  libelleDecalage: 12,

  /** Réserve haute pour la marque, basse pour l'indice d'usage. */
  reserveHaut: 56,
  reserveBas: 44,

  hauteurMarque: 56,
  ecartMarque: 14,
} as const;

/** Largeur d'une entrée quand le panneau est déployé. Le libellé tient dedans
 *  sans atteindre le bord estompé du panneau. */
export const largeurEntreeDeployee = (overscanX: number): number =>
  RAIL.largeurPanneau - overscanX - 64;

/** Largeur de l'indice d'usage, en bas du panneau déployé. */
export const largeurIndiceRail = (overscanX: number): number =>
  RAIL.largeurPanneau - overscanX - 20;

/** Borne droite des entrées déployées. Le pont de sortie du rail (tvOS) doit
 *  se poser AU-DELÀ : posé à la largeur repliée, sa bande chevauchait les
 *  entrées déployées et le moteur de focus lui détournait des HAUT/BAS. */
export const borneDroiteEntreesDeployees = (overscanX: number): number =>
  overscanX + largeurEntreeDeployee(overscanX);
