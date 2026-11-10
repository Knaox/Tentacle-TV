/**
 * Labo d'Octave — les RÉPONSES factices des pages : accueil (écoutes, ajouts, mixes du jour,
 * « parce que vous avez écouté »), artiste, titres likés, recherche, favoris de la bibliothèque.
 */

import type {
  MusicArtistResponse,
  MusicHomeResponse,
  MusicLibraryShelves,
  MusicLikedPage,
  MusicSearchResponse,
  MusicStatus,
  MusicTrack,
} from "@tentacle-tv/shared/music";
import { LAB_ALBUMS, LAB_ARTISTS } from "./labCatalog";
import { labId } from "./labIds";
import { LAB_PLAYLISTS, statsById } from "./labPlaylists";
import { LAB_TRACKS, pickTracks } from "./labTracks";

export const LAB_STATUS: MusicStatus = { available: true, libraryId: "lab-library", indexReady: true, trackCount: LAB_TRACKS.length, octaveAccess: true };

const albumsOfArtist = (artistId: string) => LAB_ALBUMS.filter((a) => a.artists[0]?.jellyfinId === artistId);
const tracksOfArtist = (artistId: string): MusicTrack[] => LAB_TRACKS.filter((t) => t.artists[0]?.jellyfinId === artistId && !t.unavailable);
const artistAt = (index: number) => LAB_ARTISTS[index % LAB_ARTISTS.length]!;

export const LAB_HOME: MusicHomeResponse = {
  recentlyPlayed: pickTracks(8, 9, 3),
  recentlyAdded: [...LAB_ALBUMS].sort((a, b) => (b.year ?? 0) - (a.year ?? 0)),
  mostPlayed: pickTracks(5, 17, 1),
  playlists: LAB_PLAYLISTS.filter((p) => p.trackCount > 0),
  forYou: {
    recentAlbums: LAB_ALBUMS.slice(0, 6),
    recentArtists: [...LAB_ARTISTS],
    mixes: [
      { id: "favorites", kind: "favorites", artist: null, artistNames: [artistAt(0).name, artistAt(1).name, artistAt(4).name], tracks: pickTracks(20, 7, 5) },
      ...[0, 3, 1, 2, 4].map((index) => ({
        id: `artist:${artistAt(index).jellyfinId ?? ""}`,
        kind: "artist" as const,
        artist: artistAt(index),
        artistNames: [artistAt(index).name, artistAt(index + 1).name, artistAt(index + 2).name],
        tracks: [...tracksOfArtist(artistAt(index).jellyfinId ?? "").slice(0, 12), ...pickTracks(8, 11, index)],
      })),
    ],
    because: [{ artist: artistAt(1), albums: albumsOfArtist(labId("ar-heures")) }],
  },
};

export function artistDetail(id: string): MusicArtistResponse | null {
  const artist = LAB_ARTISTS.find((a) => a.jellyfinId === id);
  if (!artist) return null;
  return { ...artist, topTracks: tracksOfArtist(id).slice(0, 8), albums: albumsOfArtist(id) };
}

const LIKED = LAB_TRACKS.filter((t) => t.favorite && !t.unavailable).slice(0, 26);

export const LAB_LIKED: MusicLikedPage = { items: LIKED, total: LIKED.length, cursor: null, stats: statsById(LIKED) };
export const LAB_LIKED_EMPTY: MusicLikedPage = { items: [], total: 0, cursor: null, stats: {} };

export const LAB_SHELVES: MusicLibraryShelves = {
  albums: LAB_ALBUMS.filter((a) => a.favorite),
  artists: LAB_ARTISTS.filter((a) => a.favorite),
  playlists: LAB_PLAYLISTS.filter((p) => p.favorite).map((playlist) => ({ kind: "library" as const, playlist })),
  order: { albums: [], artists: [], playlists: [] },
};

const fold = (text: string): string => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** La recherche de la bibliothèque : ce qui contient la requête (sans accents ni casse). */
export function searchResponse(query: string, limit: number): MusicSearchResponse {
  const q = fold(query.trim());
  const hit = (text: string): boolean => q !== "" && fold(text).includes(q);
  return {
    query,
    tracks: LAB_TRACKS.filter((t) => hit(t.title) || hit(t.album?.title ?? "") || t.artists.some((a) => hit(a.name))).slice(0, limit),
    albums: LAB_ALBUMS.filter((a) => hit(a.title) || a.artists.some((r) => hit(r.name))).slice(0, limit),
    artists: LAB_ARTISTS.filter((a) => hit(a.name)).slice(0, limit),
    playlists: LAB_PLAYLISTS.filter((p) => hit(p.name)).slice(0, limit),
    tookMs: 4,
  };
}
