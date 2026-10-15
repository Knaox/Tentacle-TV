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
 * Sa taille suit la carte, l'écran ET le réglage « Taille des cartes »
 * (`trailerPreviewTileSize`) : environ 42 % de la largeur de l'écran en
 * taille normale — deux vignettes d'une rangée —, à l'échelle du réglage
 * (des cartes réglées grandes donnent une grande carte plus grande), au moins
 * 1,5 × la carte, au moins aussi haute que la carte (une affiche ne rapetisse
 * jamais), et jamais plus large que la place d'une rangée.
 *
 * Elle part de la carte TELLE QU'ELLE SE DESSINE au focus — agrandie et
 * soulevée (`trailerPreviewTileFrom`) —, pas de la cellule au repos : sinon
 * la carte agrandie dépasse de la vidéo sur ses bords le temps de la
 * croissance.
 */

export interface TrailerPreviewTile {
  width: number;
  height: number;
}

/** Le format de la vidéo. */
export const TRAILER_PREVIEW_TILE_ASPECT = 16 / 9;
/** La part de la largeur de l'écran, en taille normale : deux vignettes d'une rangée, l'écart compris. */
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
  /** Le facteur du réglage « Taille des cartes » (tv-core `CARD_SIZE_SCALE`) ; 1 par défaut. */
  sizeScale?: number;
}

export function trailerPreviewTileSize(input: TrailerPreviewTileInput): TrailerPreviewTile {
  const wanted = Math.max(
    input.screenWidth * TRAILER_PREVIEW_TILE_SHARE * (input.sizeScale ?? 1),
    input.cardWidth * TRAILER_PREVIEW_TILE_MIN_GROWTH,
    input.cardHeight * TRAILER_PREVIEW_TILE_ASPECT,
  );
  const width = Math.round(Math.max(input.cardWidth, Math.min(wanted, input.maxWidth)));
  return { width, height: Math.round(width / TRAILER_PREVIEW_TILE_ASPECT) };
}

export interface TrailerPreviewRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Où la carte focalisée se DESSINE dans sa cellule : agrandie de
 * `focusScale` depuis le milieu de son bord haut, puis soulevée de `lift`
 * (`CardFrame`). La grande carte part de là.
 */
export function trailerPreviewTileFrom(input: { cardWidth: number; cardHeight: number; focusScale: number; lift: number }): TrailerPreviewRect {
  const width = input.cardWidth * input.focusScale;
  return { left: (input.cardWidth - width) / 2, top: -input.lift, width, height: input.cardHeight * input.focusScale };
}

export interface TrailerPreviewScrollInput {
  /** La place de la carte dans la rangée (cartes de largeur égale). */
  index: number;
  /** Le nombre de cartes de la rangée : la grande carte de la dernière s'arrête à la marge. */
  cardCount: number;
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
  /** La marge de droite que rien de focalisable ne dépasse (le retrait droit de la piste). */
  rightMargin: number;
}

/**
 * Le défilement qui montre la grande carte ENTIÈRE, ou `null` s'il n'y a rien
 * à faire. Une carte trop à droite pour grandir sur place vient se poser au
 * retrait de la rangée (là où commence sa première carte), comme Netflix —
 * sauf vers la fin de la rangée : la grande carte s'arrête alors à la marge
 * de droite, au bout du contenu TEL QU'IL SERA une fois la carte grandie
 * (la rangée doit en réserver la place AVANT de défiler :
 * `trailerPreviewReserve`, sinon la piste borne le défilement à son contenu
 * d'avant et la grande carte déborde de l'écran).
 */
export function trailerPreviewScrollTarget(input: TrailerPreviewScrollInput): number | null {
  const cardLeft = input.index * (input.cardWidth + input.gap);
  const screenLeft = input.inset + cardLeft - input.scrollX;
  const fits = screenLeft >= input.inset - 1 && screenLeft + input.tileWidth <= input.viewportWidth - input.rightMargin + 1;
  if (fits) return null;
  const cards = input.cardCount * input.cardWidth + Math.max(0, input.cardCount - 1) * input.gap;
  const grown = input.inset + cards + trailerPreviewReserve(input) + input.rightMargin;
  const target = Math.max(0, Math.min(cardLeft, grown - input.viewportWidth));
  return Math.abs(target - input.scrollX) < 1 ? null : target;
}

/** Ce que la rangée s'élargit quand une de ses cartes devient la grande carte. */
export function trailerPreviewReserve(input: { tileWidth: number; cardWidth: number }): number {
  return Math.max(0, Math.round(input.tileWidth - input.cardWidth));
}

export interface TrailerPreviewRevealInput {
  /** Le haut et le bas de ce qui doit se voir (la grande carte et sa légende), dans la fenêtre. */
  top: number;
  bottom: number;
  /** La hauteur de la fenêtre (1080). */
  viewportHeight: number;
  /** Les marges que rien ne dépasse en haut et en bas. */
  topMargin: number;
  bottomMargin: number;
}

/**
 * Ce que la PAGE doit défiler vers le bas (points, > 0) pour que la grande
 * carte, qui grandit vers le bas, se voie entière — `null` si elle se voit
 * déjà. Jamais au point de faire passer son haut sous la marge du haut : une
 * grande carte plus haute que l'écran garde son haut visible.
 */
export function trailerPreviewRevealOffset(input: TrailerPreviewRevealInput): number | null {
  const overflow = input.bottom - (input.viewportHeight - input.bottomMargin);
  if (overflow < 1) return null;
  const room = input.top - input.topMargin;
  const offset = Math.min(overflow, room);
  return offset < 1 ? null : Math.round(offset);
}
