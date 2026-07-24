export interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface PreviewRect {
  top: number;
  left: number;
  width: number;
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
/** Hauteur du bloc d'informations déroulé, pour le clamp vertical. */
const BODY_HEIGHT = 150;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

/** Hauteur totale du panneau pour une carte donnée (vignette + tiroir déroulé). */
export function estimatePreviewHeight(cardWidth: number): number {
  return (cardWidth * 9) / 16 + BODY_HEIGHT;
}

/**
 * Décalage vertical que le panneau subirait pour tenir dans la fenêtre. Sert à
 * REFUSER l'ouverture quand il devrait trop remonter : sur une carte proche du
 * bas de l'écran, le clamp l'arrachait de sa carte et le posait plus haut, sur
 * une rangée qui n'était pas la sienne.
 */
export function previewUpwardShift(
  cardTop: number,
  cardWidth: number,
  viewportHeight: number,
): number {
  const height = estimatePreviewHeight(cardWidth);
  const maxTop = Math.max(EDGE_MARGIN, viewportHeight - height - EDGE_MARGIN);
  return Math.max(0, cardTop - clamp(cardTop, EDGE_MARGIN, maxTop));
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
 * puis déroule son bloc d'informations vers le bas. Toutes les versions qui
 * l'élargissaient — même de 12 % — produisaient un décalage visible avec la
 * carte restée dessous, et il fallait ruser pour le rattraper. Ne rien changer
 * à la géométrie de départ supprime le problème à la racine.
 */
export function computePreviewRect(
  anchor: AnchorRect,
  viewport: { width: number; height: number },
  bounds?: PreviewBounds,
): PreviewRect {
  const minX = bounds ? bounds.left : EDGE_MARGIN;
  const maxX = bounds ? bounds.right : viewport.width - EDGE_MARGIN;
  const width = anchor.width;
  const height = (width * 9) / 16 + BODY_HEIGHT;

  const left = clamp(
    anchor.left + anchor.width / 2 - width / 2,
    minX,
    Math.max(minX, maxX - width),
  );
  // Aligné sur le HAUT de la carte, jamais centré dessus. Le panneau est plus
  // haut qu'elle (≈313 px contre 194) : centré, il débordait d'une soixantaine
  // de pixels vers le haut et recouvrait le TITRE de la rangée. Aligné en haut,
  // il ne se déploie que vers le bas, sur l'espace libre entre deux rangées.
  const top = clamp(
    anchor.top,
    EDGE_MARGIN,
    Math.max(EDGE_MARGIN, viewport.height - height - EDGE_MARGIN),
  );

  return { top, left, width };
}

/**
 * Origine de l'animation d'ouverture, en pourcentages du panneau : le zoom
 * part du centre de la CARTE, pas du centre du panneau. Sans ça, un panneau
 * recadré contre un bord d'écran semble surgir d'ailleurs.
 */
export function previewOrigin(anchor: AnchorRect, rect: PreviewRect): string {
  const height = rect.width * 0.5625 + BODY_HEIGHT;
  const x = ((anchor.left + anchor.width / 2 - rect.left) / rect.width) * 100;
  const y = ((anchor.top + anchor.height / 2 - rect.top) / height) * 100;
  return `${clamp(x, 0, 100)}% ${clamp(y, 0, 100)}%`;
}
