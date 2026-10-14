/**
 * La PLACE de la mini-carte d'aperçu — géométrie pure, sans DOM.
 *
 * UNE taille par fenêtre, la même pour une affiche et pour une vignette
 * (décision de Damien, 14/10, d'après sa référence de proportions) : environ
 * 23 % de la largeur de la fenêtre — un emplacement et demi d'une rangée qui
 * en compterait six —, bornée entre 300 et 560 px. Jamais moins de 1,2 × la
 * carte survolée : elle doit grandir VISIBLEMENT, même sur nos vignettes 16:9,
 * plus larges qu'un emplacement de six.
 *
 * Un seul gabarit : la vidéo 16:9 EN HAUT, le BANDEAU plein dessous (actions,
 * titre, infos), dont la hauteur suit la largeur (`previewPanelHeight`). Une
 * affiche est plus haute qu'une vignette : la mini-carte l'est au moins autant
 * que l'affiche soulevée, plus `PREVIEW_COVER_PX` de chaque côté — elle la
 * COUVRE. Le bandeau s'allonge alors ; son contenu reste en haut.
 *
 * Elle se pose CENTRÉE sur la carte, dans les deux axes, et ne quitte jamais
 * la fenêtre : 16 px de marge, sous la barre du haut. Une carte collée au bord
 * la voit grandir vers l'intérieur.
 *
 * L'animation d'entrée part de la CARTE (`from`, origine au centre, échelle
 * UNIFORME — jamais d'étirement) : une affiche voit la mini-carte entière
 * réduite dans son rectangle ; une vignette voit la VIDÉO posée exactement
 * sur elle (même format), le bandeau dépassant dessous le temps du fondu.
 */

export type PreviewShape = "poster" | "landscape";

export interface PreviewRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PreviewViewport {
  width: number;
  height: number;
  /**
   * Le haut de la zone utilisable : le bas de la barre de navigation fixe, qui
   * passe au-dessus de tout le contenu (la mini-carte y serait coupée, son
   * bouton de son caché). 0 sans barre.
   */
  safeTop?: number;
}

export interface PreviewPlacement extends PreviewRect {
  /** La hauteur de la vidéo, en haut ; le reste (`height - videoHeight`) est le bandeau. */
  videoHeight: number;
  /** La transformation de DÉPART : translation (px) puis échelle, origine au centre. */
  from: { x: number; y: number; scale: number };
}

/** Marge entre la mini-carte et chaque bord de la fenêtre (et la barre du haut). */
export const PREVIEW_MARGIN = 16;
/** Le format de la vidéo. */
export const PREVIEW_ASPECT = 16 / 9;
/** La part de la fenêtre : 1,5 emplacement d'une rangée de six, marges de 4 % comprises. */
export const PREVIEW_SCREEN_SHARE = 0.23;
/** Ce que la mini-carte grandit au moins, rapporté à la carte survolée. */
export const PREVIEW_MIN_GROWTH = 1.2;
/** Ce que la mini-carte d'une affiche dépasse de l'affiche soulevée, en haut et en bas. */
export const PREVIEW_COVER_PX = 8;
/**
 * Plancher : en dessous, les actions du bandeau et le titre ne tiennent plus
 * côte à côte. Atteint sous ~1 300 px de fenêtre.
 */
export const PREVIEW_MIN_WIDTH = 300;
/** Plafond : au-delà, ce n'est plus un aperçu mais un lecteur posé sur la rangée. */
export const PREVIEW_MAX_WIDTH = 560;

/**
 * La hauteur du bandeau pour une largeur de mini-carte : le bandeau COMPLET
 * (actions, titre, deux lignes d'infos), relevé sur le dessin du bandeau —
 * 128 px à 288 de large, 156 à 400, 188 à 560 —, linéaire entre ces points,
 * constante au-delà. C'est un plancher de confort : plus étroit, le bandeau
 * retire sa dernière ligne d'infos et se tasse, sans jamais déborder.
 */
const PANEL_STOPS: ReadonlyArray<readonly [number, number]> = [
  [288, 128],
  [400, 156],
  [560, 188],
];

export function previewPanelHeight(width: number): number {
  const first = PANEL_STOPS[0];
  const last = PANEL_STOPS[PANEL_STOPS.length - 1];
  if (width <= first[0]) return first[1];
  if (width >= last[0]) return last[1];
  for (let i = 1; i < PANEL_STOPS.length; i++) {
    const [w1, h1] = PANEL_STOPS[i];
    if (width > w1) continue;
    const [w0, h0] = PANEL_STOPS[i - 1];
    return Math.round(h0 + ((width - w0) / (w1 - w0)) * (h1 - h0));
  }
  return last[1];
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

/** La largeur voulue, avant ce que la fenêtre accorde : la part d'écran, la croissance minimale, les bornes. */
export function previewWidthFor(cardWidth: number, viewportWidth: number): number {
  const wanted = Math.max(viewportWidth * PREVIEW_SCREEN_SHARE, cardWidth * PREVIEW_MIN_GROWTH);
  return clamp(wanted, PREVIEW_MIN_WIDTH, PREVIEW_MAX_WIDTH);
}

/**
 * La place de la mini-carte pour une carte (`anchor`, en coordonnées de
 * fenêtre — son visuel, tel que le survol l'a soulevé). `null` quand il n'y a
 * rien à ancrer (carte sans largeur, fenêtre plus petite que les marges).
 *
 * `start` : là où la carte est VUE quand ce n'est pas sa place — une voisine
 * encore écartée par la pièce de la carte d'avant. La mini-carte se pose sur
 * sa place (`anchor`) et part de là où on la voit (`start`).
 */
export function placePreview(anchor: PreviewRect, shape: PreviewShape, viewport: PreviewViewport, start: PreviewRect = anchor): PreviewPlacement | null {
  if (!(anchor.width > 0) || !(anchor.height > 0)) return null;
  const minLeft = PREVIEW_MARGIN;
  const maxRight = viewport.width - PREVIEW_MARGIN;
  const minTop = Math.max(PREVIEW_MARGIN, (viewport.safeTop ?? 0) + PREVIEW_MARGIN);
  const maxBottom = viewport.height - PREVIEW_MARGIN;
  const roomWidth = maxRight - minLeft;
  const roomHeight = maxBottom - minTop;
  if (roomWidth <= 0 || roomHeight <= 0) return null;

  // La largeur voulue, puis ce que la fenêtre accorde — en largeur comme en
  // hauteur (vidéo + bandeau) : le 16:9 de la vidéo est intouchable, c'est la
  // taille qui cède. Le bandeau rétrécit avec la largeur : la largeur rendue
  // tient donc toujours dans la hauteur offerte.
  const wanted = previewWidthFor(anchor.width, viewport.width);
  const byHeight = (roomHeight - previewPanelHeight(wanted)) * PREVIEW_ASPECT;
  const width = Math.round(Math.max(1, Math.min(wanted, roomWidth, byHeight)));
  const videoHeight = Math.round(width / PREVIEW_ASPECT);
  const panel = previewPanelHeight(width);
  // L'affiche : jamais moins haute que l'affiche à couvrir.
  const content = videoHeight + panel;
  const height = Math.round(Math.min(
    shape === "poster" ? Math.max(content, anchor.height + 2 * PREVIEW_COVER_PX) : content,
    roomHeight,
  ));

  // Centrée sur la carte, puis rentrée dans la fenêtre. Arrondie au pixel :
  // une boîte à une coordonnée fractionnaire floute son texte.
  const centerX = anchor.left + anchor.width / 2;
  const centerY = anchor.top + anchor.height / 2;
  const left = Math.round(clamp(centerX - width / 2, minLeft, maxRight - width));
  const top = Math.round(clamp(centerY - height / 2, minTop, maxBottom - height));

  return { left, top, width, height, videoHeight, from: departure(start, shape, { left, top, width, height, videoHeight }) };
}

/**
 * Le départ de l'entrée, origine au centre de la mini-carte. Jamais une
 * échelle au-delà de 1 : une carte plus grande que sa mini-carte (fenêtre
 * minuscule) ne la fait pas rétrécir en entrant.
 */
function departure(anchor: PreviewRect, shape: PreviewShape, box: PreviewRect & { videoHeight: number }): PreviewPlacement["from"] {
  const centerX = anchor.left + anchor.width / 2;
  const centerY = anchor.top + anchor.height / 2;
  const boxX = box.left + box.width / 2;
  const boxY = box.top + box.height / 2;
  if (shape === "landscape") {
    // La VIDÉO sur la vignette : sa largeur sur la sienne, son centre (plus
    // haut que celui de la boîte, de la moitié du bandeau) sur le sien.
    const scale = Math.min(anchor.width / box.width, 1);
    const videoOffset = (box.videoHeight - box.height) / 2;
    return { x: centerX - boxX, y: centerY - (boxY + scale * videoOffset), scale };
  }
  // L'affiche : la plus grande échelle uniforme qui tient dans son rectangle.
  const scale = Math.min(anchor.width / box.width, anchor.height / box.height, 1);
  return { x: centerX - boxX, y: centerY - boxY, scale };
}

/** La transformation CSS de départ (et d'arrivée de la sortie). */
export function previewFromTransform(from: PreviewPlacement["from"]): string {
  const round = (value: number) => Math.round(value * 100) / 100;
  return `translate(${round(from.x)}px, ${round(from.y)}px) scale(${Math.round(from.scale * 10000) / 10000})`;
}
