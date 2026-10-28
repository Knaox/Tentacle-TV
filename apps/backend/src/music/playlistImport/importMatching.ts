/**
 * Octave — les titres importés confrontés à la bibliothèque du COMPTE, par LA
 * règle du cœur (`matchTracks` → `musicLibraryMatch.ts`), sur l'index local :
 * aucune requête à Jellyfin. Par lots, pour dire l'avancée pendant le travail.
 * L'ISRC n'y entre pas : l'index de la bibliothèque ne le connaît pas
 * (Jellyfin ne l'expose pas) — il reste dans les absents, pour l'extension.
 */

import type { MusicMatchTrackQuery } from "../contract/musicCoreApi";
import type { ImportedTrack } from "../contract/musicImport";
import type { IndexRow } from "../index/indexTypes";
import { matchTracks } from "../view/matchViews";
import type { UserView } from "../view/viewContext";

const BATCH = 50;

export type MatchFn = (view: UserView, queries: readonly MusicMatchTrackQuery[]) => Promise<Map<string, IndexRow>>;

const MBID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** `withRecording` : la source donne l'enregistrement MusicBrainz dans `sourceId` (un partage Tentacle). */
export function importQuery(track: ImportedTrack, withRecording = false): MusicMatchTrackQuery {
  return {
    ref: String(track.index),
    title: track.title,
    artists: track.artists.map((name) => ({ name, mbid: null })),
    albumTitle: track.album,
    durationMs: track.durationMs,
    recording: withRecording && track.sourceId && MBID.test(track.sourceId) ? track.sourceId : null,
  };
}

/** `index` du titre → l'élément de la bibliothèque. `progress(matched, found)` après chaque lot. */
export async function matchImported(
  view: UserView,
  tracks: readonly ImportedTrack[],
  progress: (matched: number, found: number) => void,
  match: MatchFn = matchTracks,
  withRecording = false,
): Promise<Map<number, IndexRow>> {
  const found = new Map<number, IndexRow>();
  for (let at = 0; at < tracks.length; at += BATCH) {
    const batch = tracks.slice(at, at + BATCH);
    const hits = await match(view, batch.map((t) => importQuery(t, withRecording)));
    for (const [ref, row] of hits) found.set(Number(ref), row);
    progress(Math.min(at + BATCH, tracks.length), found.size);
  }
  return found;
}
