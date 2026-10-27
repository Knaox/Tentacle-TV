/**
 * Octave — l'ORDRE DE LA SOURCE d'une playlist importée (règles pures, partagées par le cœur, ses clients et
 * l'extension qui fait venir les absents). Recopié octet pour octet dans `apps/backend/src/music/contract/`.
 *
 * Chaque titre importé a son RANG dans la source (`ImportedTrack.index` : l'ordre d'Apple Music, de Spotify, de
 * Deezer, de YouTube, ou des lignes collées). Un titre qui entre APRÈS l'import (livré par Lidarr, reconnu quand
 * l'index s'est mis à jour) se pose juste après celui qui le PRÉCÈDE dans la source, lu dans la playlist TELLE
 * QU'ELLE EST au moment de l'insertion — jamais à une position calculée à l'import, que chaque insertion rend fausse
 * (27/10, une playlist importée d'Apple Music : présents rejetés à la fin à l'envers, arrivées posées vers le
 * haut dans le désordre).
 *
 * Et la « Date d'ajout » d'un titre de la source suit son rang : pour Apple Music, l'ordre d'une playlist EST celui
 * des ajouts (le dernier ajouté est en bas) ; pour les autres sources, c'est le seul ordre connu.
 */

/**
 * La place (0 = tête) d'un titre de rang `rank` parmi des entrées dont `ranks[k]` est le rang dans la source
 * (`null` : une entrée qui n'en vient pas — un ajout à la main). Juste APRÈS l'entrée de rang le plus proche par
 * en dessous (la dernière, s'il y en a plusieurs : un doublon, une autre version) ; sans elle, juste AVANT l'entrée
 * de rang le plus proche par au-dessus. `null` : aucune entrée de la source, l'appelant garde sa position.
 */
export function sourcePlace(ranks: readonly (number | null)[], rank: number): number | null {
  let before = -1;
  let beforeRank = -Infinity;
  let after = -1;
  let afterRank = Infinity;
  ranks.forEach((r, k) => {
    if (r === null) return;
    if (r <= rank) {
      if (r >= beforeRank) {
        beforeRank = r;
        before = k;
      }
    } else if (r < afterRank) {
      afterRank = r;
      after = k;
    }
  });
  if (before >= 0) return before + 1;
  return after >= 0 ? after : null;
}

/**
 * Des entrées remises dans l'ordre de la source (la réparation d'une playlist importée) : par rang, à rang égal
 * dans l'ordre d'avant ; une entrée hors source reste juste après celle qui la précédait (en tête si rien ne la
 * précédait). Rien n'est retiré ni dupliqué.
 */
export function sourceOrdered<T>(entries: readonly T[], rankOf: (entry: T) => number | null): T[] {
  const head: T[] = [];
  const groups: { rank: number; at: number; items: T[] }[] = [];
  entries.forEach((entry, at) => {
    const rank = rankOf(entry);
    if (rank === null) (groups[groups.length - 1]?.items ?? head).push(entry);
    else groups.push({ rank, at, items: [entry] });
  });
  groups.sort((a, b) => a.rank - b.rank || a.at - b.at);
  return [...head, ...groups.flatMap((g) => g.items)];
}

/**
 * La date d'ajout d'un titre de la source, d'après son rang : avant l'import, le dernier de la source le plus
 * récent, une milliseconde entre deux rangs (seul l'ordre compte : la source ne date rien).
 */
export function sourceRankDate(importedAt: number, total: number, rank: number): number {
  return importedAt - Math.max(1, total - rank);
}
