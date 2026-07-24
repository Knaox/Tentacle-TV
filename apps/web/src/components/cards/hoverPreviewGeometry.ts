export interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Sens de déploiement du tiroir d'informations.
 *  • `down` — cas nominal : la vignette se pose sur la carte, le tiroir se
 *    déroule dessous ;
 *  • `up` — carte trop basse : le tiroir se déroule AU-DESSUS. La vignette,
 *    elle, ne bouge pas d'un pixel dans les deux cas.
 */
export type PreviewDirection = "down" | "up";

export interface PreviewRect {
  left: number;
  width: number;
  direction: PreviewDirection;
  /** Ancrage CSS `top` — renseigné en `down` uniquement. */
  top?: number;
  /** Ancrage CSS `bottom` — renseigné en `up` uniquement. */
  bottom?: number;
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
/** Hauteur du bloc d'informations déroulé, pour le choix du sens. */
const BODY_HEIGHT = 150;

/**
 * Décalage horizontal toléré avant de renoncer au panneau, en fraction de la
 * largeur de carte.
 *
 * La règle précédente était binaire : la carte devait tenir ENTIÈREMENT entre
 * les bornes de la rangée, sinon rien. Or la dernière carte visible d'une
 * rangée est presque toujours rognée par le bord — c'est le principe même d'un
 * carrousel, qui laisse dépasser la suivante pour signaler qu'il y a un
 * ailleurs. Ces cartes-là n'avaient donc jamais de panneau, alors qu'elles sont
 * parfaitement survolables.
 *
 * Le panneau vient désormais BUTER contre la borne de rangée. Il n'est refusé
 * que si l'écart qui en résulte dépasse un quart de la carte : en deçà il
 * recouvre encore l'essentiel de son affiche et désigne sans ambiguïté le bon
 * média ; au-delà il commence à empiéter sur la voisine.
 */
const MAX_SHIFT_RATIO = 0.25;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

/** Hauteur totale du panneau pour une carte donnée (vignette + tiroir déroulé). */
export function estimatePreviewHeight(cardWidth: number): number {
  return (cardWidth * 9) / 16 + BODY_HEIGHT;
}

/**
 * Bord gauche du panneau, borné par la rangée. Le panneau reprenant la largeur
 * EXACTE de la carte, l'idéal est le bord gauche de la carte elle-même.
 */
function boundedLeft(anchor: AnchorRect, viewportWidth: number, bounds?: PreviewBounds): number {
  const minX = bounds ? bounds.left : EDGE_MARGIN;
  const maxX = bounds ? bounds.right : viewportWidth - EDGE_MARGIN;
  return clamp(anchor.left, minX, Math.max(minX, maxX - anchor.width));
}

/**
 * De combien le panneau doit-il glisser latéralement pour tenir dans la
 * rangée ? Zéro quand la carte est entièrement visible.
 */
export function previewHorizontalShift(
  anchor: AnchorRect,
  viewportWidth: number,
  bounds?: PreviewBounds,
): number {
  return Math.abs(boundedLeft(anchor, viewportWidth, bounds) - anchor.left);
}

/**
 * Le panneau peut-il s'ouvrir sur cette carte ?
 *
 * Une seule condition reste : le décalage horizontal doit rester raisonnable
 * (cf. `MAX_SHIFT_RATIO`). La contrainte verticale a disparu — elle refusait
 * les cartes trop basses parce que le panneau, toujours déroulé vers le bas,
 * aurait dû remonter pour tenir à l'écran, et se serait retrouvé sur la rangée
 * du dessus. Le sens de déploiement s'inverse désormais (`up`) : le panneau
 * reste sur sa carte quelle que soit sa position dans la fenêtre.
 */
export function canAnchorPreview(
  anchor: AnchorRect,
  viewport: { width: number; height: number },
  bounds?: PreviewBounds,
): boolean {
  if (anchor.width === 0) return false;
  return previewHorizontalShift(anchor, viewport.width, bounds) <= anchor.width * MAX_SHIFT_RATIO;
}

/**
 * Sens de déploiement : vers le bas tant qu'il y a la place, vers le haut
 * sinon. À égalité de manque de place, on garde le bas (cas nominal).
 */
function resolveDirection(
  anchor: AnchorRect,
  viewportHeight: number,
  height: number,
): PreviewDirection {
  const roomBelow = viewportHeight - EDGE_MARGIN - anchor.top;
  const roomAbove = anchor.top + anchor.height - EDGE_MARGIN;
  if (height <= roomBelow) return "down";
  return roomAbove > roomBelow ? "up" : "down";
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
 * Verticalement, le panneau n'est JAMAIS recadré dans la fenêtre : il est
 * ancré par le bord de la carte du côté où il se déroule (`top` en `down`,
 * `bottom` en `up`). Un recadrage l'arracherait de sa carte pour le poser sur
 * une rangée qui n'est pas la sienne — c'est ce que faisait le clamp vertical
 * d'origine, raison pour laquelle il fallait alors refuser l'ouverture.
 */
export function computePreviewRect(
  anchor: AnchorRect,
  viewport: { width: number; height: number },
  bounds?: PreviewBounds,
): PreviewRect {
  const width = anchor.width;
  const left = boundedLeft(anchor, viewport.width, bounds);
  const direction = resolveDirection(anchor, viewport.height, estimatePreviewHeight(width));

  // Aligné sur un BORD de la carte, jamais centré dessus. Le panneau est plus
  // haut qu'elle (≈313 px contre 194) : centré, il déborderait d'une soixantaine
  // de pixels du mauvais côté et recouvrirait le titre de la rangée.
  return direction === "down"
    ? { left, width, direction, top: anchor.top }
    : { left, width, direction, bottom: viewport.height - (anchor.top + anchor.height) };
}

/**
 * Origine de l'animation d'ouverture, en pourcentages du panneau : le zoom
 * part du centre de la CARTE, pas du centre du panneau. Sans ça, un panneau
 * buté contre un bord d'écran semble surgir d'ailleurs — et en déploiement
 * `up`, où la vignette occupe le BAS du panneau, il dériverait franchement.
 */
export function previewOrigin(anchor: AnchorRect, rect: PreviewRect): string {
  const height = estimatePreviewHeight(rect.width);
  const panelTop =
    rect.direction === "down" ? (rect.top ?? anchor.top) : anchor.top + anchor.height - height;
  const x = ((anchor.left + anchor.width / 2 - rect.left) / rect.width) * 100;
  const y = ((anchor.top + anchor.height / 2 - panelTop) / height) * 100;
  return `${clamp(x, 0, 100)}% ${clamp(y, 0, 100)}%`;
}
