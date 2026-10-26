/**
 * Octave — ce que le serveur sait de chaque rangée pour la trier (entrée,
 * écoutes) : par entrée de playlist, par titre de la bibliothèque (likés), et
 * pour une attente hors bibliothèque, l'heure de sa demande. Pur.
 */

import type { MusicListStats } from "@tentacle-tv/shared/music";
import type { PendingMusicItem } from "@tentacle-tv/shared/music";
import type { ListRow } from "@tentacle-tv/shared/octave";
import type { StatsOf } from "./listView";

export interface StatsSources {
  byEntry?: ReadonlyMap<string, MusicListStats>;
  byJellyfin?: ReadonlyMap<string, MusicListStats>;
  pending: readonly PendingMusicItem[];
}

export function makeStatsOf({ byEntry, byJellyfin, pending }: StatsSources): StatsOf {
  const requested = new Map(pending.map((p) => [p.operationId, p.createdAt]));
  return (row: ListRow) => {
    if (row.entryId && byEntry?.has(row.entryId)) return byEntry.get(row.entryId)!;
    if (row.pending) return { addedAt: requested.get(row.pending.operationId) ?? null, plays: 0, lastPlayedAt: null };
    const id = row.track.jellyfinId;
    return (id && byJellyfin?.get(id)) || null;
  };
}
