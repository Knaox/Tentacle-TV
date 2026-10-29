/**
 * Octave — de l'index au modèle du contrat, pour UN compte : ses droits
 * (`musicAccess`), son cœur (`userFavorites`), les MBID d'artistes complétés.
 * Chaque vue part d'ici ; aucune ne lit l'index sans passer par les droits.
 */

import { getMusicAccess, type MusicAccess } from "../access/musicAccess";
import { getFavorites } from "../access/userFavorites";
import type { MusicAlbum, MusicArtist, MusicTrack } from "../contract/musicTypes";
import { artistMbids, rowsByIds } from "../index/indexQueries";
import { tracksWithFallbacks } from "./trackFallbacks";
import type { IndexRow } from "../index/indexTypes";
import { toAlbum, toArtist, toTrack, type ViewContext } from "../model/toMusic";

export interface UserView {
  userId: string;
  access: MusicAccess;
  favorites: ReadonlySet<string>;
}

const EMPTY: ReadonlySet<string> = new Set();

export async function userView(userId: string): Promise<UserView> {
  const access = await getMusicAccess(userId);
  const favorites = access.mode === "none" ? EMPTY : await getFavorites(userId, access.libraryId);
  return { userId, access, favorites };
}

export function visibleRows(view: UserView, rows: Iterable<IndexRow>): IndexRow[] {
  const list = [...rows];
  if (view.access.mode === "none") return [];
  if (view.access.mode === "all") return list;
  const visible = view.access.visible;
  return list.filter((r) => visible.has(r.id));
}

async function contextFor(view: UserView, rows: readonly IndexRow[]): Promise<ViewContext> {
  const unknown = new Set<string>();
  for (const row of rows) for (const a of row.artists) if (a.id && !a.mbid) unknown.add(a.id);
  return { favorites: view.favorites, artistMbids: unknown.size > 0 ? await artistMbids([...unknown]) : undefined };
}

export async function tracksOf(view: UserView, rows: readonly IndexRow[]): Promise<MusicTrack[]> {
  const ctx = await contextFor(view, rows);
  // La pochette d'un titre indexé avant celle de son album (Damien, 26/10) se lit sur l'album, à chaque vue.
  const tracks = await tracksWithFallbacks(rows.filter((r) => r.kind === "track"));
  return tracks.map((r) => toTrack(r, ctx));
}

export async function albumsOf(view: UserView, rows: readonly IndexRow[]): Promise<MusicAlbum[]> {
  const ctx = await contextFor(view, rows);
  return rows.filter((r) => r.kind === "album").map((r) => toAlbum(r, ctx));
}

export function artistsOf(rows: readonly IndexRow[], view?: UserView): MusicArtist[] {
  return rows.filter((r) => r.kind === "artist").map((r) => toArtist(r, view?.favorites));
}

/** Des identifiants de l'index → ceux que ce compte voit (sans lire les lignes). */
export function visibleIds(view: UserView, ids: readonly string[]): string[] {
  const access = view.access;
  if (access.mode === "none") return [];
  return access.mode === "all" ? [...ids] : ids.filter((id) => access.visible.has(id));
}

/** Des identifiants (Jellyfin) → leurs lignes VISIBLES, dans l'ordre donné. */
export async function visibleInOrder(view: UserView, ids: readonly string[]): Promise<IndexRow[]> {
  const rows = await rowsByIds(ids);
  return visibleRows(
    view,
    ids.map((id) => rows.get(id)).filter((r): r is IndexRow => r !== undefined),
  );
}

/** Un curseur opaque : le décalage, en base 36 (rien de plus à y lire). */
export function parseCursor(cursor: unknown): number {
  if (typeof cursor !== "string" || !/^[0-9a-z]{1,8}$/.test(cursor)) return 0;
  return parseInt(cursor, 36);
}

export function nextCursor(offset: number, taken: number, total: number): string | null {
  return offset + taken < total ? (offset + taken).toString(36) : null;
}

export function clampLimit(value: unknown, fallback: number, max: number): number {
  const n = typeof value === "string" ? parseInt(value, 10) : typeof value === "number" ? value : NaN;
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : fallback;
}
