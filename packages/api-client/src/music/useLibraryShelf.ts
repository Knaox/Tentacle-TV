/**
 * Octave — une RUBRIQUE de la bibliothèque rangée (règle partagée `arrangeShelf`) : « Vos favoris » en tête dans
 * l'ordre personnel, puis le reste ; et les gestes d'ordre (glisser, « Mettre en haut »). Le web, le bureau et le
 * mobile la lisent telle quelle. Sans la capacité : aucun favori, la liste telle qu'elle vient.
 */

import { useCallback, useMemo } from "react";
import { shelfKeyOf, shelfPlaylistKey, type MusicAlbum, type MusicArtist, type MusicLibraryShelves, type MusicPlaylist, type MusicShelfPlaylist, type MusicShelfSection } from "@tentacle-tv/shared/music";
import { arrangeShelf, canMoveToTop, shelfOrderAfterMove, shelfOrderToTop } from "@tentacle-tv/shared/octave";
import { useMusicShelves, useSaveShelfOrder } from "./useMusicShelves";

export interface LibraryShelf<T> {
  capable: boolean;
  ready: boolean;
  favorites: T[];
  rest: T[];
  keyOf: (item: T) => string;
  /** La section où vit l'élément (« favorites » ou « rest ») ; `null` s'il n'est pas montré. */
  sectionOf: (key: string) => "favorites" | "rest" | null;
  /** L'ordre se règle-t-il dans cette section ? (les favoris toujours ; le reste, pour les playlists seulement) */
  ordered: (key: string) => boolean;
  atTop: (key: string) => boolean;
  canReorder: (key: string) => boolean;
  moveToTop: (key: string) => void;
  move: (key: string, to: number) => void;
}

interface ShelfSpec<T> {
  section: MusicShelfSection;
  listing: readonly T[];
  keyOf: (item: T) => string;
  favoriteOf: (item: T) => boolean | undefined;
  served: (shelves: MusicLibraryShelves) => readonly T[];
  orderRest: boolean;
}

function useShelf<T>(spec: ShelfSpec<T>): LibraryShelf<T> {
  const { capable, ready, shelves } = useMusicShelves();
  const save = useSaveShelfOrder();
  const { section, listing, keyOf, favoriteOf, served, orderRest } = spec;
  const order = shelves.order[section];
  const arranged = useMemo(
    () => (capable ? arrangeShelf({ favorites: served(shelves), listing, keyOf, favoriteOf, order, orderRest }) : { favorites: [], rest: [...listing] }),
    [capable, shelves, listing, keyOf, favoriteOf, served, order, orderRest],
  );
  const keys = useMemo(() => ({ favorites: arranged.favorites.map(keyOf), rest: arranged.rest.map(keyOf) }), [arranged, keyOf]);
  const sectionOf = useCallback((key: string) => (keys.favorites.includes(key) ? "favorites" : keys.rest.includes(key) ? "rest" : null), [keys]);
  const sectionKeys = useCallback((key: string) => (sectionOf(key) === "favorites" ? keys.favorites : keys.rest), [keys, sectionOf]);
  const ordered = useCallback((key: string) => capable && (sectionOf(key) === "favorites" || (orderRest && sectionOf(key) === "rest")), [capable, sectionOf, orderRest]);
  // Le reste des playlists garde son rang quand on range les favoris (et inversement).
  const keep = useCallback((key: string) => (orderRest ? (sectionOf(key) === "favorites" ? keys.rest : keys.favorites) : []), [orderRest, sectionOf, keys]);
  return {
    capable,
    ready,
    favorites: arranged.favorites,
    rest: arranged.rest,
    keyOf,
    sectionOf,
    ordered,
    atTop: (key) => !canMoveToTop(sectionKeys(key), key),
    canReorder: (key) => sectionKeys(key).length > 1,
    moveToTop: (key) => {
      if (ordered(key)) save(section, shelfOrderToTop(order, sectionKeys(key), key, keep(key)));
    },
    move: (key, to) => {
      if (ordered(key)) save(section, shelfOrderAfterMove(order, sectionKeys(key), key, to, keep(key)));
    },
  };
}

const albumKey = (a: MusicAlbum) => shelfKeyOf(a);
const albumFavorite = (a: MusicAlbum) => a.favorite;
const servedAlbums = (s: MusicLibraryShelves) => s.albums;
const artistKey = (a: MusicArtist) => shelfKeyOf(a);
const artistFavorite = (a: MusicArtist) => a.favorite;
const servedArtists = (s: MusicLibraryShelves) => s.artists;
const playlistFavorite = (p: MusicShelfPlaylist) => (p.kind === "library" ? p.playlist.favorite : true);
const servedPlaylists = (s: MusicLibraryShelves) => s.playlists;

/** Les albums : favoris en tête, puis les pages chargées dans le tri choisi. */
export function useAlbumShelf(listing: readonly MusicAlbum[]): LibraryShelf<MusicAlbum> {
  return useShelf({ section: "albums", listing, keyOf: albumKey, favoriteOf: albumFavorite, served: servedAlbums, orderRest: false });
}

export function useArtistShelf(listing: readonly MusicArtist[]): LibraryShelf<MusicArtist> {
  return useShelf({ section: "artists", listing, keyOf: artistKey, favoriteOf: artistFavorite, served: servedArtists, orderRest: false });
}

/** Les playlists (toutes chargées) : favorites en tête — celles d'une extension comprises —, le reste dans l'ordre personnel aussi. */
export function usePlaylistShelf(playlists: readonly MusicPlaylist[] | undefined): LibraryShelf<MusicShelfPlaylist> {
  const listing = useMemo(() => (playlists ?? []).map((playlist): MusicShelfPlaylist => ({ kind: "library", playlist })), [playlists]);
  return useShelf({ section: "playlists", listing, keyOf: shelfPlaylistKey, favoriteOf: playlistFavorite, served: servedPlaylists, orderRest: true });
}
