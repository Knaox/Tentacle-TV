/**
 * La PLACE de la mini-carte d'aperçu — géométrie pure, sans DOM.
 *
 * La mini-carte est un 16:9 « un peu plus grand » que la carte survolée :
 * environ 1,8 × la largeur d'une affiche 2:3 (dont la surface est alors à
 * peine plus grande que celle de l'affiche : un cadre plus large, moins haut)
 * et 1,35 × celle d'une vignette 16:9. Elle se pose CENTRÉE sur la carte, et
 * ne quitte jamais la fenêtre : 16 px de marge sur chaque bord, sous la barre
 * du haut. Une carte collée au bord gauche ou droit la voit donc grandir vers
 * l'intérieur — le centre glisse, la carte reste désignée par l'animation qui
 * part d'elle.
 *
 * L'animation d'entrée part de la CARTE : `from` est la transformation qui
 * ramène la mini-carte (origine au centre) sur le rectangle de la carte, à
 * une échelle UNIFORME — jamais d'étirement. Sur une vignette 16:9 elle la
 * recouvre au pixel ; sur une affiche, elle en prend la largeur, au milieu.
 * Le passage d'un format à l'autre se joue en fondu croisé (`CardPreview`).
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
  /** La transformation de DÉPART : translation (px) puis échelle, origine au centre. */
  from: { x: number; y: number; scale: number };
}

/** Marge entre la mini-carte et chaque bord de la fenêtre (et la barre du haut). */
export const PREVIEW_MARGIN = 16;
/** Le format de la vidéo. */
export const PREVIEW_ASPECT = 16 / 9;
/** Largeur de la mini-carte rapportée à celle de la carte. */
export const PREVIEW_WIDTH_FACTOR: Record<PreviewShape, number> = { poster: 1.8, landscape: 1.35 };
/**
 * Plancher : en dessous, le titre et le plateau (étoiles, cinq ou six boutons)
 * ne tiennent plus côte à côte sur la vidéo. Atteint par les affiches de
 * moins de 160 px — une fenêtre étroite ou une rangée « sm ».
 */
export const PREVIEW_MIN_WIDTH = 288;
/** Plafond : au-delà, ce n'est plus un aperçu mais un lecteur posé sur la rangée. */
export const PREVIEW_MAX_WIDTH = 640;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

/**
 * La place de la mini-carte pour une carte (`anchor`, en coordonnées de
 * fenêtre — son visuel, tel que le survol l'a soulevé). `null` quand il n'y a
 * rien à ancrer (carte sans largeur, fenêtre plus petite que les marges).
 */
export function placePreview(anchor: PreviewRect, shape: PreviewShape, viewport: PreviewViewport): PreviewPlacement | null {
  if (!(anchor.width > 0) || !(anchor.height > 0)) return null;
  const minLeft = PREVIEW_MARGIN;
  const maxRight = viewport.width - PREVIEW_MARGIN;
  const minTop = Math.max(PREVIEW_MARGIN, (viewport.safeTop ?? 0) + PREVIEW_MARGIN);
  const maxBottom = viewport.height - PREVIEW_MARGIN;
  const roomWidth = maxRight - minLeft;
  const roomHeight = maxBottom - minTop;
  if (roomWidth <= 0 || roomHeight <= 0) return null;

  // La largeur voulue, puis ce que la fenêtre accorde — en largeur comme en
  // hauteur : le format est intouchable, c'est la taille qui cède.
  const wanted = clamp(anchor.width * PREVIEW_WIDTH_FACTOR[shape], PREVIEW_MIN_WIDTH, PREVIEW_MAX_WIDTH);
  const width = Math.round(Math.min(wanted, roomWidth, roomHeight * PREVIEW_ASPECT));
  const height = Math.round(width / PREVIEW_ASPECT);

  // Centrée sur la carte, puis rentrée dans la fenêtre. Arrondie au pixel :
  // une boîte fixe à une coordonnée fractionnaire floute son texte.
  const centerX = anchor.left + anchor.width / 2;
  const centerY = anchor.top + anchor.height / 2;
  const left = Math.round(clamp(centerX - width / 2, minLeft, maxRight - width));
  const top = Math.round(clamp(centerY - height / 2, minTop, maxBottom - height));

  // Le départ : la plus grande échelle UNIFORME qui tient dans la carte — la
  // largeur d'une affiche, toute la vignette d'un 16:9. Jamais au-delà de 1 :
  // une carte plus grande que sa mini-carte (fenêtre minuscule) ne la fait
  // pas rétrécir en entrant.
  const scale = Math.min(anchor.width / width, anchor.height / height, 1);
  const from = {
    x: centerX - (left + width / 2),
    y: centerY - (top + height / 2),
    scale,
  };
  return { left, top, width, height, from };
}

/** La transformation CSS de départ (et d'arrivée de la sortie). */
export function previewFromTransform(from: PreviewPlacement["from"]): string {
  const round = (value: number) => Math.round(value * 100) / 100;
  return `translate(${round(from.x)}px, ${round(from.y)}px) scale(${Math.round(from.scale * 10000) / 10000})`;
}
