/**
 * Octave — l'INSTANTANÉ d'un favori hors bibliothèque (album, artiste,
 * playlist d'une extension), tel que le client l'envoie : on n'en garde que
 * les champs d'une carte, bornés, sans ses titres. Pur. Le cœur n'analyse
 * jamais la référence de l'extension, il la rend telle quelle.
 */

import { isValidExternalRef } from "../contract/musicKeys";
import { MUSIC_SHELF_SNAPSHOT_MAX, shelfKeyOf, type MusicShelfExternalPlaylist, type MusicShelfSection } from "../contract/musicLibraryShelves";
import type { AlbumKind, ExternalRef, MusicAlbum, MusicArtist, MusicArtistRef } from "../contract/musicTypes";

const KINDS: readonly AlbumKind[] = ["album", "single", "ep", "compilation", "live", "soundtrack", "other"];

const text = (v: unknown, max = 300): string | null => (typeof v === "string" && v.length <= max ? v : null);
const optText = (v: unknown, max = 300): string | null => (typeof v === "string" ? v.slice(0, max) : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
const url = (v: unknown): string | null => (typeof v === "string" && v.length <= 2000 && (v.startsWith("/api/") || v.startsWith("https://")) ? v : null);

export function parseExternalRef(v: unknown): ExternalRef | null {
  const r = v as Partial<ExternalRef> | null;
  if (!r || typeof r.pluginId !== "string" || typeof r.id !== "string") return null;
  const ref = { pluginId: r.pluginId, id: r.id };
  return isValidExternalRef(ref) ? ref : null;
}

function artistRefs(v: unknown): MusicArtistRef[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 10).flatMap((a) => {
    const name = text((a as MusicArtistRef | null)?.name, 200);
    if (!name) return [];
    const external = parseExternalRef((a as MusicArtistRef).external);
    return [{ name, mbid: optText((a as MusicArtistRef).mbid, 36), jellyfinId: null, ...(external && { external }) }];
  });
}

function album(v: Partial<MusicAlbum>, external: ExternalRef): MusicAlbum | null {
  const title = text(v.title);
  if (!title) return null;
  return {
    key: shelfKeyOf({ jellyfinId: null, external }),
    jellyfinId: null,
    external,
    title,
    artists: artistRefs(v.artists),
    year: num(v.year),
    releaseDate: optText(v.releaseDate, 10),
    kind: KINDS.includes(v.kind as AlbumKind) ? (v.kind as AlbumKind) : "album",
    artworkUrl: url(v.artworkUrl),
    trackCount: num(v.trackCount),
    durationMs: num(v.durationMs),
    mbids: { release: optText(v.mbids?.release, 36), releaseGroup: optText(v.mbids?.releaseGroup, 36) },
    favorite: true,
  };
}

function artist(v: Partial<MusicArtist>, external: ExternalRef): MusicArtist | null {
  const name = text(v.name);
  if (!name) return null;
  return { key: shelfKeyOf({ jellyfinId: null, external }), jellyfinId: null, external, name, mbid: optText(v.mbid, 36), imageUrl: url(v.imageUrl), favorite: true };
}

function playlist(v: Partial<MusicShelfExternalPlaylist>, external: ExternalRef): MusicShelfExternalPlaylist | null {
  const title = text(v.title);
  if (!title) return null;
  return { key: shelfKeyOf({ jellyfinId: null, external }), external, title, owner: optText(v.owner, 200), trackCount: num(v.trackCount), artworkUrl: url(v.artworkUrl) };
}

export type ShelfSnapshot = MusicAlbum | MusicArtist | MusicShelfExternalPlaylist;

/** L'instantané à garder ; `null` s'il est mal formé ou trop lourd. */
export function shelfSnapshot(section: MusicShelfSection, external: ExternalRef, value: unknown): ShelfSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const kept = section === "albums" ? album(value, external) : section === "artists" ? artist(value, external) : playlist(value, external);
  return kept && JSON.stringify(kept).length <= MUSIC_SHELF_SNAPSHOT_MAX ? kept : null;
}

/** Un instantané relu de la base ; `null` s'il ne se lit plus (il n'est alors pas montré). */
export function readSnapshot(section: MusicShelfSection, json: string | null): ShelfSnapshot | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json) as { external?: unknown };
    const external = parseExternalRef(value.external);
    return external ? shelfSnapshot(section, external, value) : null;
  } catch {
    return null;
  }
}
