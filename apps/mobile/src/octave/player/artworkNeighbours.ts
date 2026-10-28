/**
 * Octave (mobile) — les pochettes à préparer AVANT le geste (`artworkNeighbours.test.ts`) : celles du titre
 * d'avant et du titre d'après dans la file (en boucle si la file se répète). Balayée, la pochette suivante est
 * déjà décodée et le fond déjà prêt : rien ne s'attend au changement de titre.
 */

import type { QueueState } from "@tentacle-tv/shared/octave";

/** Les adresses (serveur, avant jeton) des pochettes voisines du titre en cours, sans doublon ni la sienne. */
export function neighbourArtworkUrls(queue: QueueState): string[] {
  const { items, cursor, repeat } = queue;
  if (cursor < 0 || items.length < 2) return [];
  const wrap = repeat === "all";
  const at = (i: number) => (wrap ? items[(i + items.length) % items.length] : items[i]);
  const own = items[cursor]?.track.artworkUrl ?? null;
  const urls = [at(cursor + 1), at(cursor - 1)].map((item) => item?.track.artworkUrl ?? null);
  return [...new Set(urls.filter((url): url is string => url !== null && url !== own))];
}
