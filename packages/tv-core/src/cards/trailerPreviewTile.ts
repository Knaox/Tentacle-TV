/**
 * La GRANDE CARTE de l'aperçu au focus (Apple TV, Android TV) — géométrie
 * pure, en points de la scène (1920 × 1080).
 *
 * Comme Netflix au salon : la carte focalisée devient une grande vignette
 * 16:9 où la bande-annonce se joue, et la rangée lui fait PLACE — ses
 * voisines de droite glissent, la rangée s'élargit vers le bas. Rien ne se
 * pose par-dessus une autre carte : tvOS ne propose plus au focus un élément
 * recouvert par ce qui dessine (régression déjà payée), et la carte agrandie
 * reste la cible du focus, entière.
 *
 * Sa taille ne dépend que de la carte et de l'écran (`trailerPreviewTileSize`) :
 * environ 42 % de la largeur de l'écran — deux vignettes d'une rangée —, au
 * moins 1,5 × la carte (des cartes réglées plus grandes grandissent encore),
 * au moins aussi haute que la carte (une affiche ne rapetisse jamais), et
 * jamais plus large que la place d'une rangée.
 */

export interface TrailerPreviewTile {
  width: number;
  height: number;
}

/** Le format de la vidéo. */
export const TRAILER_PREVIEW_TILE_ASPECT = 16 / 9;
/** La part de la largeur de l'écran : deux vignettes d'une rangée, l'écart compris. */
export const TRAILER_PREVIEW_TILE_SHARE = 0.42;
/** Ce que la carte grandit au moins, rapporté à sa largeur. */
export const TRAILER_PREVIEW_TILE_MIN_GROWTH = 1.5;

export interface TrailerPreviewTileInput {
  cardWidth: number;
  cardHeight: number;
  /** La largeur de l'écran (1920). */
  screenWidth: number;
  /** La largeur que la rangée offre au plus (de son retrait à la marge de droite). */
  maxWidth: number;
}

export function trailerPreviewTileSize(input: TrailerPreviewTileInput): TrailerPreviewTile {
  const wanted = Math.max(
    input.screenWidth * TRAILER_PREVIEW_TILE_SHARE,
    input.cardWidth * TRAILER_PREVIEW_TILE_MIN_GROWTH,
    input.cardHeight * TRAILER_PREVIEW_TILE_ASPECT,
  );
  const width = Math.round(Math.max(input.cardWidth, Math.min(wanted, input.maxWidth)));
  return { width, height: Math.round(width / TRAILER_PREVIEW_TILE_ASPECT) };
}

export interface TrailerPreviewScrollInput {
  /** La place de la carte dans la rangée (cartes de largeur égale). */
  index: number;
  cardWidth: number;
  gap: number;
  /** Le retrait gauche de la rangée (sa première carte). */
  inset: number;
  /** Le défilement actuel de la rangée. */
  scrollX: number;
  /** La largeur de la grande carte. */
  tileWidth: number;
  /** La largeur visible de la rangée (l'écran). */
  viewportWidth: number;
  /** La marge de droite que rien de focalisable ne dépasse. */
  rightMargin: number;
}

/**
 * Le défilement qui montre la grande carte ENTIÈRE, ou `null` s'il n'y a rien
 * à faire. Une carte trop à droite pour grandir sur place vient se poser au
 * retrait de la rangée (là où commence sa première carte), comme Netflix ; la
 * rangée bornera elle-même un défilement au bout de son contenu.
 */
export function trailerPreviewScrollTarget(input: TrailerPreviewScrollInput): number | null {
  const cardLeft = input.index * (input.cardWidth + input.gap);
  const screenLeft = input.inset + cardLeft - input.scrollX;
  const fits = screenLeft >= input.inset - 1 && screenLeft + input.tileWidth <= input.viewportWidth - input.rightMargin;
  if (fits) return null;
  return Math.abs(cardLeft - input.scrollX) < 1 ? null : cardLeft;
}
