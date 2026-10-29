/**
 * Octave — une ligne de l'index devient le modèle du contrat (`MusicTrack`,
 * `MusicAlbum`, `MusicArtist`), pour UN compte (son cœur). Pur.
 *
 * Les pochettes passent par le cœur (`/api/music/artwork/:id`), jamais par
 * Jellyfin en direct ; l'étiquette de l'image voyage dans l'URL : une pochette
 * changée a une autre URL, l'ancienne peut se garder un an.
 */

import { MUSIC_ROUTES } from "../contract/musicCoreApi";
import { libraryTrackKey } from "../contract/musicKeys";
import type { MusicAlbum, MusicArtist, MusicArtistRef, MusicTrack } from "../contract/musicTypes";
import type { IndexArtist, IndexRow } from "../index/indexTypes";

export interface ViewContext {
  favorites: ReadonlySet<string>;
  /** Élément MusicArtist → MBID, pour compléter les crédits des titres. */
  artistMbids?: ReadonlyMap<string, string>;
}

export function artworkUrl(imageTag: string | null): string | null {
  if (!imageTag) return null;
  const [owner, tag] = imageTag.split("/");
  if (!owner || !tag) return null;
  return `${MUSIC_ROUTES.artwork.replace(":id", owner)}?tag=${encodeURIComponent(tag)}`;
}

function artistRef(artist: IndexArtist, ctx: ViewContext): MusicArtistRef {
  const mbid = artist.mbid ?? (artist.id ? ctx.artistMbids?.get(artist.id) : undefined) ?? null;
  return { name: artist.name, mbid, jellyfinId: artist.id };
}

export function toTrack(row: IndexRow, ctx: ViewContext): MusicTrack {
  const artists = row.artists.map((a) => artistRef(a, ctx));
  return {
    key: libraryTrackKey(row.id),
    jellyfinId: row.id,
    external: null,
    title: row.name,
    artists,
    album: row.albumName ? { title: row.albumName, mbid: row.releaseMbid, jellyfinId: row.albumId } : null,
    durationMs: row.durationMs,
    trackNumber: row.trackNumber,
    discNumber: row.discNumber,
    year: row.year,
    artworkUrl: artworkUrl(row.imageTag),
    mbids: {
      recording: row.recordingMbid,
      release: row.releaseMbid,
      releaseGroup: row.releaseGroupMbid,
      artists: artists.map((a) => a.mbid).filter((m): m is string => m !== null),
    },
    availability: "library",
    format: row.format,
    favorite: ctx.favorites.has(row.id),
  };
}

export function toAlbum(row: IndexRow, ctx: ViewContext): MusicAlbum {
  return {
    key: `jf:${row.id}`,
    jellyfinId: row.id,
    external: null,
    title: row.name,
    artists: row.artists.map((a) => artistRef(a, ctx)),
    year: row.year,
    releaseDate: null,
    // Jellyfin ne dit pas le type de parution (album, EP, single…) : « album ».
    kind: "album",
    artworkUrl: artworkUrl(row.imageTag),
    trackCount: row.childCount,
    durationMs: row.durationMs,
    mbids: { release: row.releaseMbid, releaseGroup: row.releaseGroupMbid },
    // Le favori Jellyfin de l'album (`music.libraryFavorites`).
    favorite: ctx.favorites.has(row.id),
  };
}

/** `favorites` : le favori Jellyfin de l'artiste (`music.libraryFavorites`) ; absent, le champ ne part pas. */
export function toArtist(row: IndexRow, favorites?: ReadonlySet<string>): MusicArtist {
  return {
    ...(favorites && { favorite: favorites.has(row.id) }),
    key: `jf:${row.id}`,
    jellyfinId: row.id,
    external: null,
    name: row.name,
    mbid: row.artistMbid,
    imageUrl: artworkUrl(row.imageTag),
  };
}
