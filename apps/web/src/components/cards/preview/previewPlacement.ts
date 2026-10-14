/**
 * La PLACE de la mini-carte d'aperçu — géométrie pure, sans DOM.
 *
 * Deux gabarits, un par format de carte :
 *
 *   • VIGNETTE 16:9 (`landscape`) : la vidéo seule, 1,35 × la vignette. Même
 *     format, plus grande : elle la recouvre entièrement.
 *   • AFFICHE 2:3 (`poster`) : la vidéo 16:9 EN HAUT, et sous elle un BANDEAU
 *     plein (titre, année · durée, étoiles, plateau) — comme Netflix. Un 16:9
 *     seul est moins haut qu'une affiche : l'affiche effacée laissait un trou,
 *     et la voisine dépassait au-dessus et en dessous (essai de Damien,
 *     14/10). La mini-carte est donc au moins aussi haute que l'affiche
 *     soulevée (plus `PREVIEW_COVER_PX` de chaque côté) : elle la COUVRE, et
 *     les voisines, de même hauteur, ne dépassent plus que sur le côté.
 *
 * Elle se pose CENTRÉE sur la carte et ne quitte jamais la fenêtre : 16 px de
 * marge, sous la barre du haut. Une carte collée au bord la voit grandir vers
 * l'intérieur.
 *
 * L'animation d'entrée part de la CARTE : `from` ramène la mini-carte (origine
 * au centre) dans le rectangle de la carte, à une échelle UNIFORME — jamais
 * d'étirement. Le passage d'un format à l'autre se joue en fondu croisé.
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
/** Largeur de la mini-carte rapportée à celle de la carte. */
export const PREVIEW_WIDTH_FACTOR: Record<PreviewShape, number> = { poster: 1.75, landscape: 1.35 };
/** Le bandeau d'une affiche, au plus juste : titre, année · durée, étoiles et plateau. */
export const PREVIEW_PANEL_MIN = 118;
/** Ce que la mini-carte d'une affiche dépasse de l'affiche soulevée, en haut et en bas. */
export const PREVIEW_COVER_PX = 8;
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
  // hauteur : le 16:9 de la vidéo est intouchable, c'est la taille qui cède.
  const panel = shape === "poster" ? PREVIEW_PANEL_MIN : 0;
  const wanted = clamp(anchor.width * PREVIEW_WIDTH_FACTOR[shape], PREVIEW_MIN_WIDTH, PREVIEW_MAX_WIDTH);
  const width = Math.round(Math.max(1, Math.min(wanted, roomWidth, (roomHeight - panel) * PREVIEW_ASPECT)));
  const videoHeight = Math.round(width / PREVIEW_ASPECT);
  // L'affiche : vidéo + bandeau, et jamais moins haute que l'affiche à couvrir.
  const height = shape === "poster"
    ? Math.round(Math.min(Math.max(videoHeight + panel, anchor.height + 2 * PREVIEW_COVER_PX), roomHeight))
    : videoHeight;

  // Centrée sur la carte, puis rentrée dans la fenêtre. Arrondie au pixel :
  // une boîte fixe à une coordonnée fractionnaire floute son texte.
  const centerX = anchor.left + anchor.width / 2;
  const centerY = anchor.top + anchor.height / 2;
  const left = Math.round(clamp(centerX - width / 2, minLeft, maxRight - width));
  const top = Math.round(clamp(centerY - height / 2, minTop, maxBottom - height));

  // Le départ : la plus grande échelle UNIFORME qui tient dans la carte —
  // toute la vignette d'un 16:9, la largeur d'une affiche. Jamais au-delà de 1 :
  // une carte plus grande que sa mini-carte (fenêtre minuscule) ne la fait
  // pas rétrécir en entrant.
  const scale = Math.min(anchor.width / width, anchor.height / height, 1);
  const from = {
    x: centerX - (left + width / 2),
    y: centerY - (top + height / 2),
    scale,
  };
  return { left, top, width, height, videoHeight, from };
}

/** La transformation CSS de départ (et d'arrivée de la sortie). */
export function previewFromTransform(from: PreviewPlacement["from"]): string {
  const round = (value: number) => Math.round(value * 100) / 100;
  return `translate(${round(from.x)}px, ${round(from.y)}px) scale(${Math.round(from.scale * 10000) / 10000})`;
}
