/**
 * Octave — les FAVORIS de la bibliothèque (albums, artistes, playlists) et
 * l'ORDRE PERSONNEL de chaque rubrique. Capacité `music.libraryFavorites`
 * (1.40.0).
 *
 * Fichier du CONTRAT, recopié octet pour octet dans le backend
 * (`apps/backend/src/music/contract/`). Pur : ni React, ni DOM, ni horloge.
 *
 * - Un album, un artiste, une playlist de la BIBLIOTHÈQUE : le favori EST le
 *   favori Jellyfin du compte (`IsFavorite`, comme le cœur d'un titre). Seule
 *   exception, une playlist qu'un autre compte m'a partagée (Jellyfin ne me la
 *   montre pas : il refuserait le favori) — Tentacle le garde.
 * - Un élément HORS bibliothèque (celui d'une extension : `external`) : le
 *   favori est gardé par TENTACLE, avec un INSTANTANÉ de ce qu'il faut pour en
 *   montrer la carte (titre, pochette, référence). Le cœur ne l'analyse jamais.
 * - L'ordre personnel d'une rubrique est une liste de CLÉS (`shelfKeyOf`),
 *   gardée par compte (`music_list_prefs`, clé `library:<rubrique>`).
 */

import type { ExternalRef, MusicAlbum, MusicArtist, MusicPlaylist } from "./musicTypes";

export type MusicShelfSection = "albums" | "artists" | "playlists";
export const MUSIC_SHELF_SECTIONS: readonly MusicShelfSection[] = ["albums", "artists", "playlists"];

export const MUSIC_SHELF_ROUTES = {
  /** GET — les favoris du compte, par rubrique, et l'ordre personnel de chacune (`MusicLibraryShelves`). */
  shelves: "/api/music/library/shelves",
  /** PUT `MusicShelfFavoriteRequest` — pose ou retire un favori (bibliothèque ou hors bibliothèque). */
  favorite: "/api/music/library/favorite",
  /** PUT { keys } — l'ordre personnel d'une rubrique (`albums`, `artists`, `playlists`). */
  order: "/api/music/library/order/:section",
} as const;

/** Au-delà, l'ordre est refusé (400) ; un favori hors bibliothèque se décrit en 16 Ko au plus. */
export const MUSIC_SHELF_ORDER_MAX = 5_000;
export const MUSIC_SHELF_SNAPSHOT_MAX = 16_384;

/** Une playlist HORS bibliothèque, telle qu'on la garde en favori (la forme d'`ExternalMusicPlaylist`, sans ses titres). */
export interface MusicShelfExternalPlaylist {
  key: string;
  external: ExternalRef;
  title: string;
  owner: string | null;
  trackCount: number | null;
  artworkUrl: string | null;
}

/** Une playlist d'une rubrique : celle de la bibliothèque (Jellyfin), ou celle d'une extension. */
export type MusicShelfPlaylist =
  | { kind: "library"; playlist: MusicPlaylist }
  | { kind: "external"; playlist: MusicShelfExternalPlaylist };

/** `GET /api/music/library/shelves` — les FAVORIS (dans aucun ordre particulier) et l'ordre de chaque rubrique. */
export interface MusicLibraryShelves {
  albums: MusicAlbum[];
  artists: MusicArtist[];
  playlists: MusicShelfPlaylist[];
  /** Les clés de chaque rubrique, dans l'ordre posé ; vide : jamais réordonnée. */
  order: Record<MusicShelfSection, string[]>;
}

/** Un favori à poser ou retirer : un élément de la bibliothèque (`jellyfinId`) ou d'une extension (`external` + instantané). */
export type MusicShelfFavoriteRequest =
  | { section: MusicShelfSection; jellyfinId: string; favorite: boolean }
  | { section: "albums"; external: ExternalRef; album: MusicAlbum; favorite: boolean }
  | { section: "artists"; external: ExternalRef; artist: MusicArtist; favorite: boolean }
  | { section: "playlists"; external: ExternalRef; playlist: MusicShelfExternalPlaylist; favorite: boolean };

export interface MusicShelfFavoriteOutcome {
  section: MusicShelfSection;
  key: string;
  favorite: boolean;
}

/** La clé d'un élément dans sa rubrique : `jf:<id>` (bibliothèque) ou `ext:<extension>:<id>` — jamais une position. */
export function shelfKeyOf(item: { jellyfinId: string | null; external?: ExternalRef | null; key?: string }): string {
  if (item.jellyfinId) return `jf:${item.jellyfinId.replace(/-/g, "").toLowerCase()}`;
  if (item.external) return `ext:${item.external.pluginId}:${item.external.id}`;
  return item.key ?? "";
}

export function shelfPlaylistKey(entry: MusicShelfPlaylist): string {
  return entry.kind === "library" ? shelfKeyOf({ jellyfinId: entry.playlist.jellyfinId }) : shelfKeyOf({ jellyfinId: null, external: entry.playlist.external });
}

export function parseShelfSection(raw: unknown): MusicShelfSection | null {
  return MUSIC_SHELF_SECTIONS.find((s) => s === raw) ?? null;
}

/** L'ordre reçu d'un client ; `null` s'il est mal formé. Une clé en double ne compte qu'une fois. */
export function parseShelfOrder(value: unknown): string[] | null {
  if (!value || typeof value !== "object") return null;
  const keys = (value as { keys?: unknown }).keys;
  if (!Array.isArray(keys) || keys.length > MUSIC_SHELF_ORDER_MAX) return null;
  if (!keys.every((k) => typeof k === "string" && k.length > 0 && k.length <= 300)) return null;
  return [...new Set(keys as string[])];
}

/** La clé de préférence d'une rubrique dans `music_list_prefs` (jamais celle d'une liste de titres). */
export function shelfListKey(section: MusicShelfSection): `library:${MusicShelfSection}` {
  return `library:${section}`;
}
