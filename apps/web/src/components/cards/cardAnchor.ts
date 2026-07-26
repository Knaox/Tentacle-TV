import { canAnchorPreview } from "./hoverPreviewGeometry";
import type { AnchorRect, PreviewBounds } from "./hoverPreviewGeometry";

/**
 * Mesures DOM de l'ancre du panneau d'aperçu — extraites de `useHoverPreview`
 * pour tenir la limite de 300 lignes. `hoverPreviewGeometry` reste PUR (des
 * rectangles, aucun élément) : c'est ce qui le rend testable sans DOM.
 */

/**
 * Bornes horizontales du panneau : la zone de CONTENU de la rangée, c'est-à-dire
 * son rectangle amputé de sa propre gouttière (`row-gutter`, lue en CSS donc
 * juste à tous les points de rupture — 16 px en mobile, 56 px au-delà).
 *
 * C'est la borne exacte, ni plus ni moins, et la mesure le montre : sur une
 * rangée de 1432 px, le disque de la flèche droite occupe 1380→1420, soit
 * entièrement dans les 56 px de gouttière, tandis que la première carte
 * commence pile à 56. Borner sur la gouttière garde donc les flèches
 * cliquables ET aligne le panneau sur sa carte.
 *
 * Deux réglages plus larges ont échoué avant celui-ci : la fenêtre entière
 * (le panneau débordait dans la gouttière, mal cadré) puis une réserve fixe de
 * 72 px (plus large que la gouttière, elle poussait le panneau de la première
 * carte vers la droite — le décalage visible à l'écran).
 */
export function boundsFor(card: HTMLElement | null): PreviewBounds | undefined {
  const row = card?.closest<HTMLElement>(".row-dim");
  if (!row) return undefined;
  const r = row.getBoundingClientRect();
  const cs = getComputedStyle(row);
  return {
    left: r.left + (parseFloat(cs.paddingLeft) || 0),
    right: r.right - (parseFloat(cs.paddingRight) || 0),
  };
}

/**
 * Boîte que le panneau recouvre : le VISUEL de la carte, pas la carte entière.
 *
 * La racine porte aussi le bloc titre, une cinquantaine de pixels sous l'image.
 * Tant que le panneau se déroulait vers le bas, l'écart ne se voyait pas — il
 * s'aligne alors sur le HAUT, commun aux deux boîtes. Dès qu'il se déroule vers
 * le haut, c'est le BAS qui sert d'ancre, et la vignette du panneau atterrissait
 * une cinquantaine de pixels trop bas.
 */
export function visualRect(card: HTMLElement): AnchorRect {
  const el = card.querySelector<HTMLElement>("[data-card-visual]") ?? card;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * Le panneau peut-il se poser SUR cette carte ? Oui, dès qu'elle a une largeur.
 *
 * Cette fonction ne refuse plus rien, et c'est le résultat de trois itérations.
 * Elle exigeait d'abord que la carte tienne entièrement dans la rangée, puis que
 * le décalage de butée reste sous un tiers de sa largeur — chaque règle privait
 * d'aperçu des cartes parfaitement survolables. La disposition superposée
 * (`overlay`) supprime la cause : un panneau qui ne quitte jamais sa carte n'a
 * besoin ni de place libre ni de tolérance.
 */
export function canPlacePanel(card: HTMLElement | null): boolean {
  return card ? canAnchorPreview(visualRect(card)) : false;
}
