export interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Disposition du panneau.
 *  • `down` — cas nominal : le panneau se pose sur la carte et déroule son
 *    tiroir d'informations DESSOUS, dans l'espace libre entre deux rangées ;
 *  • `overlay` — le panneau ne dépasse pas d'un pixel de la carte : le tiroir
 *    se pose SUR l'image, en voile translucide.
 *
 * `overlay` a remplacé un `up` qui dépliait le tiroir vers le haut. Le geste
 * était géométriquement correct — la vignette ne bougeait pas — mais il
 * recouvrait le titre de la rangée du dessus, et surtout un tiroir qui s'ouvre
 * vers le haut sur certaines cartes et vers le bas sur d'autres se lit comme
 * une incohérence, pas comme une adaptation. Rester DANS la carte règle les
 * deux cas d'un même geste : plus rien à recouvrir, plus rien à déborder.
 */
export type PreviewDirection = "down" | "overlay";

export interface PreviewRect {
  top: number;
  left: number;
  width: number;
  direction: PreviewDirection;
  /**
   * Hauteur imposée — `overlay` uniquement, où le panneau épouse exactement la
   * carte. En `down` la hauteur suit le contenu (vignette + tiroir déroulé).
   */
  height?: number;
  /**
   * Rognage à appliquer au panneau, en pixels depuis chaque bord, pour qu'il ne
   * dépasse jamais de la rangée. Non nul seulement sur une carte de bord.
   */
  clip?: { left: number; right: number };
}

/** Marge minimale entre le panneau et le haut / bas de la fenêtre. */
const EDGE_MARGIN = 16;
/**
 * Bornes horizontales dans lesquelles le panneau doit tenir, en coordonnées de
 * fenêtre. Calculées par l'appelant à partir de la rangée réelle : elles
 * excluent une flèche de défilement UNIQUEMENT du côté où elle est affichée.
 *
 * Le panneau est portalisé sur `document.body` en `z-40`, alors que les
 * flèches vivent dans le contexte d'empilement `z-10` de la page : aucune
 * valeur de `z-index` ne peut les faire repasser devant, d'où cette parade
 * géométrique. Mais réserver les deux côtés en permanence décalait le panneau
 * de la PREMIÈRE carte alors qu'aucune flèche gauche n'est visible tant que la
 * rangée n'a pas défilé — le panneau paraissait mal cadré, sans raison.
 */
export interface PreviewBounds {
  left: number;
  right: number;
}
/**
 * Hauteur FIXE du tiroir d'informations déroulé, en pixels.
 *
 * Constante et non plus estimée : le rendu (`HoverPreviewBody` anime la hauteur
 * du tiroir vers cette valeur exacte, `HoverPreviewInfo` la remplit) et la
 * géométrie (choix du sens, origine du zoom) lisent désormais la MÊME valeur. Le
 * tiroir avait jusqu'ici une hauteur `auto` qui dépendait de la présence et de
 * la longueur du synopsis — trois hauteurs possibles pour une même carte. La
 * zone haute (actions, code S/E, méta) est fixe ; le synopsis occupe le reste,
 * défilant si besoin, sans jamais changer la hauteur totale.
 *
 * 176 px logent la zone haute plus ~3-4 lignes de synopsis.
 */
export const DRAWER_HEIGHT = 176;
/** Alias interne — la géométrie raisonne en « hauteur du corps ». */
const BODY_HEIGHT = DRAWER_HEIGHT;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

/** Hauteur totale du panneau pour une carte donnée (vignette + tiroir déroulé). */
export function estimatePreviewHeight(cardWidth: number): number {
  return (cardWidth * 9) / 16 + BODY_HEIGHT;
}

/**
 * De combien la carte dépasse-t-elle des bornes de la rangée ? Zéro quand elle
 * est entièrement visible.
 *
 * C'est ce dépassement qui décide de la disposition : une carte rognée reçoit
 * le panneau `overlay`, qui ne dépasse pas d'elle et se rogne comme elle. Le
 * panneau ne GLISSE plus jamais latéralement — le faire buter contre la borne
 * de rangée le désolidarisait de sa carte, et il fallait alors un seuil
 * arbitraire au-delà duquel on renonçait à l'ouvrir.
 */
export function previewOverflow(
  anchor: AnchorRect,
  viewportWidth: number,
  bounds?: PreviewBounds,
): { left: number; right: number } {
  const minX = bounds ? bounds.left : EDGE_MARGIN;
  const maxX = bounds ? bounds.right : viewportWidth - EDGE_MARGIN;
  return {
    left: Math.max(0, minX - anchor.left),
    right: Math.max(0, anchor.left + anchor.width - maxX),
  };
}

/**
 * Le panneau peut-il s'ouvrir sur cette carte ? Oui, dès qu'elle a une largeur.
 *
 * Toutes les conditions de refus ont disparu, une par une, parce que chacune
 * privait d'aperçu des cartes parfaitement survolables : la carte devait tenir
 * entièrement dans la rangée (or la dernière visible d'un carrousel est rognée
 * par construction), puis le décalage de butée devait rester sous un tiers de
 * la carte. La disposition `overlay` supprime la cause : un panneau qui ne
 * quitte pas sa carte n'a besoin ni de place ni de tolérance.
 */
export function canAnchorPreview(anchor: AnchorRect): boolean {
  return anchor.width > 0;
}

/**
 * Disposition : tiroir déroulé sous la carte tant qu'il y a la place ET que la
 * carte est entière ; sinon panneau confiné à la carte.
 */
function resolveDirection(
  anchor: AnchorRect,
  viewportHeight: number,
  height: number,
  overflow: { left: number; right: number },
): PreviewDirection {
  if (overflow.left > 0 || overflow.right > 0) return "overlay";
  return anchor.top + height <= viewportHeight - EDGE_MARGIN ? "down" : "overlay";
}

/**
 * Place le panneau d'aperçu — réservé aux cartes 16:9 (« épisode »).
 *
 * Les affiches verticales n'en ont plus : quelle que soit la règle de
 * placement, un panneau flottant au-dessus d'une colonne étroite finissait
 * toujours décalé par rapport à sa carte, parce que les contraintes de bord
 * d'écran et de flèches de rangée le poussent latéralement alors que la carte,
 * elle, ne bouge pas. Elles utilisent un survol INTERNE (cf. `PosterTile`),
 * qui ne peut pas se désaligner puisqu'il ne quitte jamais la carte.
 *
 * Le panneau reprend EXACTEMENT la largeur et l'origine de la carte. Il ne
 * l'agrandit pas et ne recadre pas son image : il s'y superpose au pixel près,
 * puis déroule son bloc d'informations. Toutes les versions qui l'élargissaient
 * — même de 12 % — produisaient un décalage visible avec la carte restée
 * dessous, et il fallait ruser pour le rattraper. Ne rien changer à la
 * géométrie de départ supprime le problème à la racine.
 *
 * Le panneau ne se DÉPLACE jamais pour tenir quelque part : il part de la carte
 * et y reste. Quand la place manque en bas, ou quand la carte est rognée par le
 * bord de la rangée, c'est la disposition qui change (`overlay`) — le tiroir se
 * pose alors sur l'image au lieu de se dérouler dessous. Toutes les variantes
 * qui déplaçaient le panneau, latéralement contre une borne ou verticalement
 * pour rentrer dans la fenêtre, ont fini par le désigner à côté de son média.
 */
export function computePreviewRect(
  anchor: AnchorRect,
  viewport: { width: number; height: number },
  bounds?: PreviewBounds,
): PreviewRect {
  const width = anchor.width;
  const overflow = previewOverflow(anchor, viewport.width, bounds);
  const direction = resolveDirection(
    anchor,
    viewport.height,
    estimatePreviewHeight(width),
    overflow,
  );

  const rect: PreviewRect = { top: anchor.top, left: anchor.left, width, direction };
  if (direction === "down") return rect;

  // Confiné à la carte : même hauteur, et rogné exactement comme elle l'est par
  // la rangée. Sans ce rognage, le panneau — portalisé hors du conteneur qui
  // rogne la carte — révélerait une partie que la carte ne montre pas, et
  // passerait par-dessus les flèches de défilement.
  return {
    ...rect,
    height: anchor.height,
    clip: overflow.left > 0 || overflow.right > 0 ? overflow : undefined,
  };
}

/**
 * Origine de l'animation d'ouverture, en pourcentages du panneau : le zoom part
 * du centre de la VIGNETTE. En `overlay` la vignette EST le panneau, l'origine
 * est donc son centre ; en `down` elle n'occupe que le haut, et un centre
 * géométrique ferait dériver l'image au fil du déroulé du tiroir.
 */
export function previewOrigin(anchor: AnchorRect, rect: PreviewRect): string {
  if (rect.direction === "overlay") return "50% 50%";
  const height = estimatePreviewHeight(rect.width);
  const y = ((anchor.top + anchor.height / 2 - rect.top) / height) * 100;
  return `50% ${clamp(y, 0, 100)}%`;
}
