import type { Box } from "@tentacle-tv/tv-core";
import { isHorizontal, type Direction } from "./keys";
import { collect } from "./candidates";

/**
 * Entrer dans une piste par sa PREMIÈRE CARTE VISIBLE — la règle des
 * carrousels, partagée avec Apple TV et Android TV (`RowEntryGuide`).
 *
 * La géométrie visait la carte située sous le point de départ : depuis le bout
 * d'une rangée, c'était une carte du milieu de la suivante, que le cadrage
 * faisait aussitôt défiler. On changeait de rangée, et c'était l'autre qui
 * partait de côté. Une rangée jamais parcourue s'ouvre donc sur sa première
 * carte ; une rangée qu'on a fait défiler garde sa position, et l'on entre par
 * la première carte qu'elle montre.
 *
 * Seules les arrivées VERTICALES sont redirigées : à l'horizontale on est déjà
 * dans la piste, ou l'on y entre par son bord — ce qui revient au même.
 */

/** Une cible et sa boîte de navigation, telles que le recensement les rend. */
export interface TrackCard {
  element: HTMLElement;
  box: Box;
}

/** Tolérance d'arrondi : un bord à un pixel près reste un bord. */
const EDGE_TOLERANCE = 1;

/**
 * La première carte ENTIÈREMENT visible dans la fenêtre de la piste, sinon —
 * aucune ne l'est, la piste est plus étroite qu'une carte — celle qui en
 * montre le plus. Pur : c'est ce qui se teste.
 */
export function leftmostVisible(cards: TrackCard[], view: { left: number; right: number }): HTMLElement | null {
  let best: TrackCard | null = null;
  for (const card of cards) {
    const inside = card.box.left >= view.left - EDGE_TOLERANCE && card.box.right <= view.right + EDGE_TOLERANCE;
    if (!inside) continue;
    if (!best || card.box.left < best.box.left) best = card;
  }
  if (best) return best.element;

  let widest: TrackCard | null = null;
  let widestShown = 0;
  for (const card of cards) {
    const shown = Math.min(card.box.right, view.right) - Math.max(card.box.left, view.left);
    if (shown > widestShown) {
      widest = card;
      widestShown = shown;
    }
  }
  return widest?.element ?? null;
}

/**
 * La redirection elle-même : `null` quand il n'y a rien à rediriger — arrivée
 * horizontale, hors piste, déplacement interne à la piste, ou arrivée déjà sur
 * la bonne carte.
 */
export function redirectTrackEntry(
  start: HTMLElement | null,
  arrival: HTMLElement,
  direction: Direction,
): HTMLElement | null {
  if (isHorizontal(direction)) return null;
  const track = arrival.closest<HTMLElement>("[data-tv-piste]");
  if (!track) return null;
  if (start && track.contains(start)) return null;

  const rect = track.getBoundingClientRect();
  const target = leftmostVisible(collect(track), { left: rect.left, right: rect.right });
  if (!target || target === arrival) return null;
  return target;
}
