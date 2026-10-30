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
 *
 * Une attente qui n'est PAS née d'un import (ni `imported`, ni `sourceIndex`) est un ajout de l'utilisateur, où
 * qu'elle soit (en tête depuis `music.addOnTop`, ou avant des titres ajoutés après elle) : sa demande, comme en fin
 * de liste — celle que l'extension passe à son arrivée (`jellyfin.playlistInsert` + `addedAt`).
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
  added: ReadonlySet<string> = new Set(),
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
    if (index < lastDated && !added.has(row.pending.operationId)) at = previous ?? natural.slice(index + 1).map(entryDate).find((d) => d !== null) ?? asked;
    else at = previous === null ? asked : asked === null ? previous : Math.max(previous, asked);
    out.set(row.pending.operationId, at);
    // Un ajout de l'utilisateur ne date pas l'attente posée qui le suit : elle prend la date de SA place.
    if (!added.has(row.pending.operationId)) previous = at ?? previous;
  });
  return out;
}

export function makeStatsOf({ byEntry, byJellyfin, pending, natural }: StatsSources): StatsOf {
  const requested = new Map(pending.map((p) => [p.operationId, p.createdAt]));
  const added = new Set(pending.filter((p) => p.imported !== true && typeof p.sourceIndex !== "number").map((p) => p.operationId));
  const placed = natural && byEntry ? placedPendingDates(natural, byEntry, requested, added) : null;
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
