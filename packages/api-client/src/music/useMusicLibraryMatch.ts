/**
 * Octave — ce que la bibliothèque du compte a parmi des titres et des albums
 * montrés hors bibliothèque (`POST /api/music/match`, capacité
 * `music.libraryMatch` : sans elle, aucune requête et rien de reconnu). Une
 * requête par ensemble montré, gardée en cache, relue quand la bibliothèque
 * change (`music:library`, `music:resolved` : un titre importé bascule sans
 * recharger).
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MusicAlbum, MusicMatchAlbumQuery, MusicMatchRequest, MusicMatchTrackQuery, MusicTrack } from "@tentacle-tv/shared/music";
import { useServerCapability } from "../hooks/useServerCapabilities";
import { musicApi } from "./musicApi";
import { KEEP_PREVIOUS, musicKeys } from "./musicQueryKeys";
import { useMusicCapability } from "./useMusicLibrary";

const STALE_MS = 5 * 60_000;
const MAX_TRACKS = 200;
const MAX_ALBUMS = 50;
const MAX_ALBUM_TRACKS = 300;

export interface LibraryAlbumMatch {
  album: MusicAlbum;
  /** `full` : tous ses titres sont dans la bibliothèque — l'album de la bibliothèque le remplace. */
  coverage: "full" | "partial";
  /** Ses titres que la bibliothèque a, par clé du titre d'origine. */
  tracks: ReadonlyMap<string, MusicTrack>;
}

export interface LibraryMatches {
  /** Le titre de la bibliothèque qui EST ce titre (par sa clé `ext:`), s'il y en a un. */
  tracks: ReadonlyMap<string, MusicTrack>;
  albums: ReadonlyMap<string, LibraryAlbumMatch>;
  /** La réponse pour CET ensemble est là (ou il n'y avait rien à demander). */
  settled: boolean;
}

/** Hors bibliothèque, et pas encore reconnu : ce qui vaut d'être demandé. */
const isOutside = (item: { external: unknown; jellyfinId: string | null }) => item.external !== null && item.jellyfinId === null;

export function trackMatchQuery(track: MusicTrack): MusicMatchTrackQuery {
  return {
    ref: track.key,
    title: track.title,
    artists: track.artists.map((a) => ({ name: a.name, mbid: a.mbid })),
    albumTitle: track.album?.title ?? null,
    durationMs: track.durationMs,
    recording: track.mbids.recording,
    discNumber: track.discNumber,
    trackNumber: track.trackNumber,
  };
}

export function albumMatchQuery(album: MusicAlbum, tracks?: readonly MusicTrack[]): MusicMatchAlbumQuery {
  return {
    ref: album.key,
    title: album.title,
    artists: album.artists.map((a) => ({ name: a.name, mbid: a.mbid })),
    release: album.mbids.release,
    releaseGroup: album.mbids.releaseGroup,
    compilation: album.kind === "compilation" || album.kind === "soundtrack",
    trackCount: album.trackCount,
    ...(tracks ? { tracks: tracks.filter(isOutside).map(trackMatchQuery) } : {}),
  };
}

/** La demande pour ce qui est montré : bornée, sans doublon, `null` s'il n'y a rien à demander. Pur. */
export function libraryMatchRequest(tracks: readonly MusicTrack[], albums: readonly { album: MusicAlbum; tracks?: readonly MusicTrack[] }[]): MusicMatchRequest | null {
  const seen = new Set<string>();
  const once = <T extends { key: string }>(x: T) => (seen.has(x.key) ? false : (seen.add(x.key), true));
  const outAlbums: MusicMatchAlbumQuery[] = [];
  let budget = MAX_ALBUM_TRACKS;
  for (const entry of albums.filter((a) => isOutside(a.album) && once(a.album)).slice(0, MAX_ALBUMS)) {
    const own = entry.tracks?.filter(isOutside).slice(0, Math.max(0, budget));
    budget -= own?.length ?? 0;
    outAlbums.push(albumMatchQuery(entry.album, own));
  }
  const outTracks = tracks.filter((t) => isOutside(t) && once(t)).slice(0, MAX_TRACKS).map(trackMatchQuery);
  if (outTracks.length === 0 && outAlbums.length === 0) return null;
  return { tracks: outTracks, albums: outAlbums };
}

/** La clé de cache d'une demande : ses clés et ce qui peut changer leur verdict. */
function signatureOf(request: MusicMatchRequest): string {
  const tracks = (request.tracks ?? []).map((t) => `${t.ref}@${t.durationMs ?? ""}`).sort();
  const albums = (request.albums ?? []).map((a) => `${a.ref}#${a.trackCount ?? ""}[${(a.tracks ?? []).map((t) => t.ref).join(",")}]`).sort();
  return `${tracks.join("|")}//${albums.join("|")}`;
}

const NONE: LibraryMatches = { tracks: new Map(), albums: new Map(), settled: true };

export function useMusicLibraryMatch(tracks: readonly MusicTrack[], albums: readonly { album: MusicAlbum; tracks?: readonly MusicTrack[] }[] = []): LibraryMatches {
  const library = useMusicCapability();
  const matching = useServerCapability("music.libraryMatch");
  const capable = library && matching;
  const request = useMemo(() => (capable ? libraryMatchRequest(tracks, albums) : null), [capable, tracks, albums]);
  const signature = useMemo(() => (request ? signatureOf(request) : ""), [request]);
  const query = useQuery({
    queryKey: musicKeys.match(signature),
    queryFn: ({ signal }) => musicApi.match(request!, signal),
    enabled: request !== null,
    staleTime: STALE_MS,
    retry: false,
    ...KEEP_PREVIOUS,
  });
  const data = request ? query.data : undefined;
  const settled = request === null || query.isError || (query.status === "success" && !query.isPlaceholderData);
  return useMemo(() => {
    if (!data) return settled ? NONE : { ...NONE, settled: false };
    return {
      tracks: new Map(data.tracks.map((m) => [m.ref, m.track])),
      albums: new Map(data.albums.map((m) => [m.ref, { album: m.album, coverage: m.coverage, tracks: new Map(m.tracks.map((t) => [t.ref, t.track])) }])),
      settled,
    };
  }, [data, settled]);
}
