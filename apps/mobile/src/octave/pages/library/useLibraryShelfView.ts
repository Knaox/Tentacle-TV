/**
 * Octave mobile — un onglet de la bibliothèque RANGÉ par le socle partagé (`useAlbumShelf`, `useArtistShelf`,
 * `usePlaylistShelf` : « Vos favoris » en tête dans l'ordre personnel, puis le reste) : les éléments de la
 * grille, et la rubrique qu'une carte passe à sa feuille d'actions (« Mettre en haut », « Réordonner »).
 * Aucune règle ici : l'ordre vient d'api-client, la vue ne fait que poser.
 */

import { useMemo } from "react";
import { useAlbumShelf, useArtistShelf, usePlaylistShelf, type LibraryShelf } from "@tentacle-tv/api-client";
import type { LibraryTab } from "@tentacle-tv/shared/octave";
import type { MusicAlbum, MusicArtist, MusicPlaylist, MusicShelfPlaylist } from "@tentacle-tv/shared/music";

export type LibraryItem = { kind: "album"; album: MusicAlbum } | { kind: "artist"; artist: MusicArtist } | { kind: "playlist"; entry: MusicShelfPlaylist };

export interface LibraryShelfView {
  favorites: LibraryItem[];
  rest: LibraryItem[];
  keyOf: (item: LibraryItem) => string;
  /** La rubrique de l'onglet (pour les gestes d'ordre) — typée large : la feuille n'en lit que les clés. */
  shelf: LibraryShelf<unknown>;
}

const albumItem = (album: MusicAlbum): LibraryItem => ({ kind: "album", album });
const artistItem = (artist: MusicArtist): LibraryItem => ({ kind: "artist", artist });
const playlistItem = (entry: MusicShelfPlaylist): LibraryItem => ({ kind: "playlist", entry });

export function useLibraryShelfView(tab: LibraryTab, albums: readonly MusicAlbum[], artists: readonly MusicArtist[], playlists: readonly MusicPlaylist[] | undefined): LibraryShelfView {
  const albumShelf = useAlbumShelf(albums);
  const artistShelf = useArtistShelf(artists);
  const playlistShelf = usePlaylistShelf(playlists);
  return useMemo(() => {
    if (tab === "albums") return view(albumShelf, albumItem, (i) => (i.kind === "album" ? albumShelf.keyOf(i.album) : ""));
    if (tab === "artists") return view(artistShelf, artistItem, (i) => (i.kind === "artist" ? artistShelf.keyOf(i.artist) : ""));
    return view(playlistShelf, playlistItem, (i) => (i.kind === "playlist" ? playlistShelf.keyOf(i.entry) : ""));
  }, [tab, albumShelf, artistShelf, playlistShelf]);
}

function view<T>(shelf: LibraryShelf<T>, wrap: (item: T) => LibraryItem, keyOf: (item: LibraryItem) => string): LibraryShelfView {
  return { favorites: shelf.favorites.map(wrap), rest: shelf.rest.map(wrap), keyOf, shelf: shelf as unknown as LibraryShelf<unknown> };
}
