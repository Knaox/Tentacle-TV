/** Octave — une ligne d'index vue par la règle de tri du contrat (`musicListOrder.ts`). Pur. */

import { libraryTrackKey } from "../contract/musicKeys";
import type { MusicListStats, MusicListSubject } from "../contract/musicListOrder";
import type { IndexRow } from "../index/indexTypes";

export function rowSubject(row: IndexRow, stats: MusicListStats | null): MusicListSubject {
  return {
    key: libraryTrackKey(row.id),
    title: row.name,
    artist: row.artists[0]?.name ?? row.albumArtist ?? "",
    album: row.albumName ?? "",
    disc: row.discNumber,
    track: row.trackNumber,
    durationMs: row.durationMs,
    year: row.year,
    recording: row.recordingMbid,
    stats,
  };
}
