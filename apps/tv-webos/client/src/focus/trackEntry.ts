import { best, type Box } from "@tentacle-tv/tv-core";
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

/**
 * Sortir d'une piste par son BORD, sous un piège — la surcouche de recherche.
 *
 * L'horizontale reste confinée à sa piste (`movement.ts`), et c'est juste :
 * sans cela le bout d'une rangée partirait en diagonale dans la suivante. Hors
 * piège, la gauche garde une porte, le rail. Sous un piège, il n'y en avait
 * aucune : depuis la première carte d'une rangée de résultats, « gauche » ne
 * menait plus à la colonne de saisie — une impasse.
 *
 * La porte s'ouvre donc au bord réel (plus rien à faire défiler), et seulement
 * vers ce qui est HORS de la zone de la piste : jamais une autre rangée de la
 * même zone, la règle qui interdit la diagonale tient toujours.
 */
export function trackExit(
  start: HTMLElement,
  direction: Direction,
  trap: ParentNode | null,
  since: Box,
): HTMLElement | null {
  if (!trap || !isHorizontal(direction)) return null;
  const track = start.closest<HTMLElement>("[data-tv-piste]");
  const zone = track?.parentElement?.closest<HTMLElement>("[data-tv-zone]");
  if (!track || !zone || !atEdge(track, direction)) return null;
  const outside = collect(trap).filter((candidate) => !zone.contains(candidate.element));
  return best(since, outside, direction)?.element ?? null;
}

/** La piste a-t-elle encore du chemin dans cette direction ? Au pixel près. */
function atEdge(track: HTMLElement, direction: Direction): boolean {
  if (direction === "gauche") return track.scrollLeft <= 1;
  return track.scrollLeft + track.clientWidth >= track.scrollWidth - 1;
}
