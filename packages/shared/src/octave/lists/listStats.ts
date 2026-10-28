/**
 * Octave — ce que le serveur sait de chaque rangée pour la trier (entrée,
 * écoutes) : par entrée de playlist, par titre de la bibliothèque (likés), et
 * pour une attente hors bibliothèque, l'heure de sa demande. Pur.
 *
 * Dans une playlist (`natural`), une attente posée AVANT une entrée datée
 * (un import entier, à sa place) prend la date de l'entrée qui la précède,
 * comme le serveur datera son arrivée (`addedPlan.ts`) : « Derniers ajouts »
 * suit l'ordre d'ajout, sans saut quand Lidarr la livre. En fin de liste,
 * c'est un ajout : sa demande, jamais avant l'entrée qui la précède.
 */

import type { MusicListStats } from "../../music";
import type { PendingMusicItem } from "../../music";
import type { ListRow } from "../pendingMerge";
import type { StatsOf } from "./listView";

export interface StatsSources {
  byEntry?: ReadonlyMap<string, MusicListStats>;
  byJellyfin?: ReadonlyMap<string, MusicListStats>;
  pending: readonly PendingMusicItem[];
  /** La playlist dans son ordre naturel : ses attentes sont datées par leur place. */
  natural?: readonly ListRow[];
}

/** La date d'entrée de chaque attente d'une playlist, par `operationId`. */
export function placedPendingDates(
  natural: readonly ListRow[],
  byEntry: ReadonlyMap<string, MusicListStats>,
  requested: ReadonlyMap<string, number>,
): Map<string, number | null> {
  const entryDate = (row: ListRow) => (row.entryId ? (byEntry.get(row.entryId)?.addedAt ?? null) : null);
  let lastDated = -1;
  natural.forEach((row, index) => {
    if (entryDate(row) !== null) lastDated = index;
  });
  const out = new Map<string, number | null>();
  let previous: number | null = null;
  natural.forEach((row, index) => {
    if (!row.pending) {
      previous = entryDate(row) ?? previous;
      return;
    }
    const asked = requested.get(row.pending.operationId) ?? null;
    let at: number | null;
    if (index < lastDated) at = previous ?? natural.slice(index + 1).map(entryDate).find((d) => d !== null) ?? asked;
    else at = previous === null ? asked : asked === null ? previous : Math.max(previous, asked);
    out.set(row.pending.operationId, at);
    previous = at ?? previous;
  });
  return out;
}

export function makeStatsOf({ byEntry, byJellyfin, pending, natural }: StatsSources): StatsOf {
  const requested = new Map(pending.map((p) => [p.operationId, p.createdAt]));
  const placed = natural && byEntry ? placedPendingDates(natural, byEntry, requested) : null;
  return (row: ListRow) => {
    if (row.entryId && byEntry?.has(row.entryId)) return byEntry.get(row.entryId)!;
    if (row.pending) {
      const id = row.pending.operationId;
      return { addedAt: placed?.has(id) ? placed.get(id)! : (requested.get(id) ?? null), plays: 0, lastPlayedAt: null };
    }
    const id = row.track.jellyfinId;
    return (id && byJellyfin?.get(id)) || null;
  };
}
