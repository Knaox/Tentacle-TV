/**
 * Octave — `POST /api/music/match` : ce que la bibliothèque de CE compte a
 * parmi des titres et des albums montrés hors bibliothèque. Tout se lit dans
 * l'index local (aucune requête à Jellyfin, aucune à l'extension) et la règle
 * est celle du contrat (`musicLibraryMatch.ts`). Les droits passent par
 * `visibleRows`, comme partout.
 *
 * Un album est reconnu (MBID, ou titre + artiste) puis ses titres le sont
 * DANS cet album (titre ou place, ± 2 s) ; un titre qui n'y est pas est
 * cherché dans toute la bibliothèque (un single, une autre parution). Un
 * album dont aucun des titres listés n'est reconnu est un homonyme : écarté.
 */

import type { MusicMatchAlbumQuery, MusicMatchRequest, MusicMatchResponse, MusicMatchTrackQuery } from "../contract/musicCoreApi";
import { bestMatch, isSameAlbum, isSameAlbumTrack, isVariousCredit, type MatchableAlbum, type MatchableTrack } from "../contract/musicLibraryMatch";
import type { MusicTrack } from "../contract/musicTypes";
import { albumTracks, tracksByRecording } from "../index/indexQueries";
import type { IndexRow } from "../index/indexTypes";
import { albumsByMbids, rowsNamed } from "../index/matchQueries";
import { albumsOf, tracksOf, visibleRows, type UserView } from "./viewContext";

const TRACK_CANDIDATES = 40;
const ALBUM_CANDIDATES = 20;

export function trackMatchable(row: IndexRow): MatchableTrack {
  return {
    title: row.name,
    artists: row.artists.map((a) => ({ name: a.name, mbid: a.mbid })),
    albumTitle: row.albumName,
    durationMs: row.durationMs,
    recording: row.recordingMbid,
    discNumber: row.discNumber,
    trackNumber: row.trackNumber,
  };
}

export function albumMatchable(row: IndexRow): MatchableAlbum {
  const artists = row.artists.map((a) => ({ name: a.name, mbid: a.mbid }));
  const albumArtist = row.albumArtist ? [{ name: row.albumArtist, mbid: null }] : [];
  return {
    title: row.name,
    artists: [...albumArtist, ...artists],
    release: row.releaseMbid,
    releaseGroup: row.releaseGroupMbid,
    compilation: albumArtist.length > 0 && isVariousCredit(albumArtist),
  };
}

const queryTrack = (q: MusicMatchTrackQuery): MatchableTrack => q;

/**
 * Les titres de la bibliothèque pour ces requêtes : MBID d'abord, puis le nom (une recherche par titre distinct).
 * Aussi l'API d'hôte `jellyfin.matchTracks` (music/host) : une extension reconnaît par LA même règle.
 */
export async function matchTracks(view: UserView, queries: readonly MusicMatchTrackQuery[]): Promise<Map<string, IndexRow>> {
  const found = new Map<string, IndexRow>();
  const recordings = [...new Set(queries.map((q) => q.recording).filter((r): r is string => r !== null))];
  const byRecording = new Map(visibleRows(view, await tracksByRecording(recordings)).map((r) => [r.recordingMbid, r]));
  const named = new Map<string, IndexRow[]>();
  for (const q of queries) {
    const exact = q.recording ? byRecording.get(q.recording) : undefined;
    if (exact) {
      found.set(q.ref, exact);
      continue;
    }
    const key = q.title.toLowerCase();
    if (!named.has(key)) named.set(key, visibleRows(view, await rowsNamed("track", q.title, TRACK_CANDIDATES)));
    const best = bestMatch(queryTrack(q), named.get(key) ?? [], trackMatchable);
    if (best) found.set(q.ref, best);
  }
  return found;
}

interface AlbumHit {
  query: MusicMatchAlbumQuery;
  row: IndexRow;
  tracks: Map<string, IndexRow>;
  full: boolean;
}

/** Les titres d'une requête d'album reconnus DANS l'album de la bibliothèque (chacun pris une fois). */
function withinAlbum(query: MusicMatchAlbumQuery, own: readonly IndexRow[]): Map<string, IndexRow> {
  const out = new Map<string, IndexRow>();
  const free = new Set(own);
  for (const q of query.tracks ?? []) {
    const best = bestMatch(queryTrack(q), [...free], trackMatchable, isSameAlbumTrack);
    if (best) {
      out.set(q.ref, best);
      free.delete(best);
    }
  }
  return out;
}

async function matchAlbum(view: UserView, query: MusicMatchAlbumQuery, byMbid: readonly IndexRow[]): Promise<AlbumHit | null> {
  const wanted: MatchableAlbum = query;
  const candidates = [...byMbid, ...visibleRows(view, await rowsNamed("album", query.title, ALBUM_CANDIDATES))];
  let best: AlbumHit | null = null;
  const seen = new Set<string>();
  for (const row of candidates) {
    if (seen.has(row.id) || !isSameAlbum(albumMatchable(row), wanted)) continue;
    seen.add(row.id);
    // Une liste vide ne dit rien des titres : c'est alors le compte de titres qui juge, comme pour une carte.
    const listed = (query.tracks?.length ?? 0) > 0;
    const tracks = listed ? withinAlbum(query, visibleRows(view, await albumTracks(row.id))) : new Map<string, IndexRow>();
    // Des titres listés, aucun reconnu : un homonyme.
    if (listed && tracks.size === 0) continue;
    const full = listed ? tracks.size === query.tracks!.length : query.trackCount !== null && query.trackCount > 0 && (row.childCount ?? 0) >= query.trackCount;
    if (!best || tracks.size > best.tracks.size) best = { query, row, tracks, full };
  }
  return best;
}

const pairs = (map: ReadonlyMap<string, IndexRow>, built: ReadonlyMap<string, MusicTrack>) =>
  [...map].flatMap(([ref, row]) => {
    const track = built.get(row.id);
    return track ? [{ ref, track }] : [];
  });

export async function matchView(view: UserView, request: Required<MusicMatchRequest>): Promise<MusicMatchResponse> {
  if (view.access.mode === "none") return { tracks: [], albums: [] };
  const mbidAlbums = visibleRows(
    view,
    await albumsByMbids(
      request.albums.map((a) => a.release).filter((m): m is string => m !== null),
      request.albums.map((a) => a.releaseGroup).filter((m): m is string => m !== null),
    ),
  );
  const hits: AlbumHit[] = [];
  for (const query of request.albums) {
    const hit = await matchAlbum(view, query, mbidAlbums);
    if (hit) hits.push(hit);
  }
  // Les titres des albums que leur album n'a pas : cherchés dans toute la bibliothèque, comme les titres seuls.
  const inAlbums = new Set(hits.flatMap((h) => [...h.tracks.keys()]));
  const loose = [...request.tracks, ...request.albums.flatMap((a) => a.tracks ?? []).filter((t) => !inAlbums.has(t.ref))];
  const global = await matchTracks(view, loose);
  for (const hit of hits) for (const t of hit.query.tracks ?? []) if (!hit.tracks.has(t.ref) && global.has(t.ref)) hit.tracks.set(t.ref, global.get(t.ref)!);

  const rows = new Map<string, IndexRow>();
  for (const r of [...global.values(), ...hits.flatMap((h) => [...h.tracks.values()])]) rows.set(r.id, r);
  const built = new Map((await tracksOf(view, [...rows.values()])).map((t) => [t.jellyfinId ?? "", t]));
  const albums = new Map((await albumsOf(view, hits.map((h) => h.row))).map((a) => [a.jellyfinId ?? "", a]));
  const allTracks = new Map<string, IndexRow>(global);
  for (const hit of hits) for (const [ref, row] of hit.tracks) allTracks.set(ref, row);
  return {
    tracks: pairs(allTracks, built),
    albums: hits.flatMap((hit) => {
      const album = albums.get(hit.row.id);
      return album ? [{ ref: hit.query.ref, album, coverage: hit.full ? ("full" as const) : ("partial" as const), tracks: pairs(hit.tracks, built) }] : [];
    }),
  };
}
