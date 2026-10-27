/**
 * Octave — la MISE EN PAGE d'une recherche validée, façon Apple Music. Règle pure, sur ce qui est MONTRÉ
 * (`useRevealedResults`) :
 * - le MEILLEUR RÉSULTAT : celui que l'extension désigne (`top`), remplacé par son jumeau de bibliothèque s'il
 *   y en a un (il se lit tout de suite) ; sans désignation, aucun ;
 * - à côté, les titres à lire d'un geste : un TITRE en tête les ouvre (R5-06, recette de R4 : la liste commence par
 *   la piste officielle, comme chez Apple Music et Spotify), sinon ceux du meilleur résultat (artiste, album), puis
 *   les autres ;
 * - puis les sections : titres (le titre en tête, la bibliothèque, l'extension sans ses jumeaux, rien deux fois),
 *   albums, artistes, playlists — l'album, l'artiste ou la playlist de la carte n'y sont pas répétés ;
 * - un filtre (`SearchFilter`) ne garde que sa liste.
 */

import type { ExternalMusicPlaylist, ExternalMusicTop, MusicAlbum, MusicArtist, MusicPlaylist, MusicSearchResponse, MusicTrack } from "../../music";
import { sameTrack } from "../trackTwins";
import { libraryTwin, sameAlbum, sameArtist, withoutTwins } from "./libraryTwins";

export type SearchFilter = "all" | "tracks" | "albums" | "artists" | "playlists";

export interface ShownExternalLists {
  top: ExternalMusicTop | null;
  tracks: MusicTrack[];
  albums: MusicAlbum[];
  artists: MusicArtist[];
  playlists: ExternalMusicPlaylist[];
}

export type TopResult =
  | { kind: "track"; track: MusicTrack }
  | { kind: "album"; album: MusicAlbum }
  | { kind: "artist"; artist: MusicArtist }
  | { kind: "playlist"; playlist: ExternalMusicPlaylist };

export interface SearchLayout {
  top: TopResult | null;
  /** Les titres à côté du meilleur résultat (vue « Tout »). */
  sideTracks: MusicTrack[];
  tracks: MusicTrack[];
  albums: MusicAlbum[];
  artists: MusicArtist[];
  libraryPlaylists: MusicPlaylist[];
  externalPlaylists: ExternalMusicPlaylist[];
}

export const SIDE_TRACKS = 6;

function uniqueByKey<T extends { key: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.key) ? false : (seen.add(item.key), true)));
}

function topOf(top: ExternalMusicTop | null, library: MusicSearchResponse | null): TopResult | null {
  if (!top) return null;
  const own = library ?? { tracks: [], albums: [], artists: [] };
  switch (top.kind) {
    case "track":
      return { kind: "track", track: libraryTwin(top.track, own.tracks, sameTrack) ?? top.track };
    case "album":
      return { kind: "album", album: libraryTwin(top.album, own.albums, sameAlbum) ?? top.album };
    case "artist":
      return { kind: "artist", artist: libraryTwin(top.artist, own.artists, sameArtist) ?? top.artist };
    default:
      return { kind: "playlist", playlist: top.playlist };
  }
}

/** Une liste de titres de l'extension, chacun remplacé par son jumeau de bibliothèque. */
const owned = (tracks: readonly MusicTrack[], library: readonly MusicTrack[]) => tracks.map((t) => libraryTwin(t, library, sameTrack) ?? t);

export function layoutSearch(library: MusicSearchResponse | null, external: ShownExternalLists | null): SearchLayout {
  const lib = library ?? { query: "", tracks: [], albums: [], artists: [], playlists: [], tookMs: 0 };
  const ext = external ?? { top: null, tracks: [], albums: [], artists: [], playlists: [] };
  const top = topOf(ext.top, library);
  const topTracks = ext.top && (ext.top.kind === "artist" || ext.top.kind === "album") ? owned(ext.top.tracks ?? [], lib.tracks) : [];
  const shownTop = top?.kind === "track" ? [top.track] : [];
  // Le titre en tête d'abord, puis la bibliothèque (elle se lit tout de suite), puis l'extension sans ses jumeaux.
  const tracks = uniqueByKey([...shownTop, ...lib.tracks, ...withoutTwins(ext.tracks, lib.tracks, sameTrack)]);
  const sideTracks = uniqueByKey([...shownTop, ...topTracks, ...tracks]).slice(0, SIDE_TRACKS);
  const topKey = top ? (top.kind === "track" ? top.track.key : top.kind === "album" ? top.album.key : top.kind === "artist" ? top.artist.key : top.playlist.key) : null;
  const notTop = <T extends { key: string }>(item: T) => item.key !== topKey;
  return {
    top,
    sideTracks,
    tracks,
    albums: uniqueByKey([...lib.albums, ...withoutTwins(ext.albums, lib.albums, sameAlbum)]).filter(notTop),
    artists: uniqueByKey([...lib.artists, ...withoutTwins(ext.artists, lib.artists, sameArtist)]).filter(notTop),
    libraryPlaylists: lib.playlists,
    externalPlaylists: uniqueByKey(ext.playlists).filter(notTop),
  };
}

/** Rien du tout à montrer (ni meilleur résultat, ni titre, ni carte) ? */
export function isEmptyLayout(layout: SearchLayout): boolean {
  return !layout.top && layout.tracks.length === 0 && layout.albums.length === 0 && layout.artists.length === 0 && layout.libraryPlaylists.length === 0 && layout.externalPlaylists.length === 0;
}
