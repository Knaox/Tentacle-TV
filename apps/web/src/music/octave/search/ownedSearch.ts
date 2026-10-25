/**
 * Octave — la section de l'extension d'une recherche, face à la bibliothèque (`POST /api/music/match`) : un titre
 * qu'elle a devient le sien (le meilleur résultat compris), un album qu'elle a en entier devient le sien, un album
 * en partie présent reste celui d'ailleurs, marqué. La mise en page (`searchLayout`) retire ensuite les doublons
 * par clé. `useOwnedLists` : la même demande (même clé de cache) sert la révélation et l'affichage.
 */

import { useMemo } from "react";
import { useMusicLibraryMatch, type LibraryMatches } from "@tentacle-tv/api-client";
import type { ExternalMusicTop, MusicAlbum, MusicTrack } from "@tentacle-tv/shared/music";
import { ownedAlbums, ownedTracks, type AlbumOwnership } from "../library/ownedItems";
import type { ShownExternalLists } from "./searchLayout";

export interface OwnedLists {
  lists: ShownExternalLists | null;
  /** La pastille de chaque carte d'album reconnue, par clé de la carte MONTRÉE. */
  albumOwnership: ReadonlyMap<string, AlbumOwnership>;
  settled: boolean;
}

/** Ce qu'il faut demander : les titres et albums de la section, ceux du meilleur résultat compris. */
export function matchInputOf(lists: ShownExternalLists | null): { tracks: MusicTrack[]; albums: { album: MusicAlbum }[] } {
  if (!lists) return { tracks: [], albums: [] };
  const top = lists.top;
  const topTracks = !top ? [] : top.kind === "track" ? [top.track] : top.kind === "album" || top.kind === "artist" ? (top.tracks ?? []) : [];
  const topAlbum = top?.kind === "album" ? [top.album] : [];
  return { tracks: [...topTracks, ...lists.tracks], albums: [...topAlbum, ...lists.albums].map((album) => ({ album })) };
}

function ownedTop(top: ExternalMusicTop | null, matches: LibraryMatches, marks: Map<string, AlbumOwnership>): ExternalMusicTop | null {
  if (!top) return null;
  const tracks = (list: MusicTrack[] | undefined) => (list ? [...ownedTracks(list, matches.tracks)] : undefined);
  switch (top.kind) {
    case "track":
      return { kind: "track", track: matches.tracks.get(top.track.key) ?? top.track };
    case "album": {
      const [shown] = ownedAlbums([top.album], matches.albums);
      if (shown?.ownership) marks.set(shown.album.key, shown.ownership);
      return { kind: "album", album: shown?.album ?? top.album, tracks: tracks(top.tracks) };
    }
    case "artist":
      return { kind: "artist", artist: top.artist, tracks: tracks(top.tracks) };
    default:
      return top;
  }
}

/** Pur : la section avec ce que la bibliothèque a. */
export function ownedLists(lists: ShownExternalLists | null, matches: LibraryMatches): Omit<OwnedLists, "settled"> {
  const marks = new Map<string, AlbumOwnership>();
  if (!lists || (matches.tracks.size === 0 && matches.albums.size === 0)) return { lists, albumOwnership: marks };
  const albums = ownedAlbums(lists.albums, matches.albums);
  for (const { album, ownership } of albums) if (ownership) marks.set(album.key, ownership);
  return {
    lists: { ...lists, top: ownedTop(lists.top, matches, marks), tracks: [...ownedTracks(lists.tracks, matches.tracks)], albums: albums.map((a) => a.album) },
    albumOwnership: marks,
  };
}

export function useOwnedLists(lists: ShownExternalLists | null): OwnedLists {
  const input = useMemo(() => matchInputOf(lists), [lists]);
  const matches = useMusicLibraryMatch(input.tracks, input.albums);
  return useMemo(() => ({ ...ownedLists(lists, matches), settled: matches.settled }), [lists, matches]);
}
