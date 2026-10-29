/**
 * Octave — la bibliothèque musique vue par UN compte : état, recherche,
 * albums, artistes. L'index répond seul (aucune requête à Jellyfin), sauf les
 * titres phares d'un artiste, qui sont ceux que CE compte écoute le plus, et la
 * description d'un album (`albumDescription.ts`), lue à son ouverture.
 */

import type { MusicAlbumPage, MusicArtistPage, MusicArtistResponse, MusicSearchResponse, MusicStatus } from "../contract/musicCoreApi";
import type { MusicAlbum } from "../contract/musicTypes";
import { albumTracks, countsByKind, creditedTo, orderedIds, rowById, searchIndex, type ListOrder } from "../index/indexQueries";
import { syncState } from "../index/indexSync";
import { ftsMatchExpression } from "../index/searchQuery";
import { jfAdmin, normalizeId, q, type JfItemsPage } from "../jellyfin/musicJellyfin";
import { albumDescription } from "./albumDescription";
import { searchPlaylists } from "./playlistViews";
import { albumsOf, artistsOf, nextCursor, tracksOf, visibleIds, visibleInOrder, visibleRows, type UserView } from "./viewContext";

export async function statusView(view: UserView): Promise<MusicStatus> {
  const sync = syncState();
  if (view.access.mode === "none") return { available: false, libraryId: null, indexReady: sync.ready, trackCount: 0 };
  const access = view.access;
  const trackCount =
    access.mode === "all"
      ? (await countsByKind()).track
      : (await orderedIds("track", "name")).filter((id) => access.visible.has(id)).length;
  return { available: true, libraryId: view.access.libraryId, indexReady: sync.ready, trackCount };
}

export interface SearchLimits {
  tracks: number;
  albums: number;
  artists: number;
  playlists: number;
}

export async function searchView(view: UserView, query: string, limits: SearchLimits, startedAt: number): Promise<MusicSearchResponse> {
  const empty: MusicSearchResponse = { query, tracks: [], albums: [], artists: [], playlists: [], tookMs: 0 };
  const match = ftsMatchExpression(query);
  if (!match || view.access.mode === "none") return { ...empty, tookMs: Date.now() - startedAt };
  const budget = Math.min(400, (limits.tracks + limits.albums + limits.artists) * 4);
  const [hits, playlists] = await Promise.all([searchIndex(match, budget), searchPlaylists(view, query, limits.playlists)]);
  const rows = await visibleInOrder(view, hits.map((h) => h.id));
  const take = (kind: string, n: number) => rows.filter((r) => r.kind === kind).slice(0, n);
  const [tracks, albums] = await Promise.all([tracksOf(view, take("track", limits.tracks)), albumsOf(view, take("album", limits.albums))]);
  return { query, tracks, albums, artists: artistsOf(take("artist", limits.artists), view), playlists, tookMs: Date.now() - startedAt };
}

export async function albumsPageView(view: UserView, offset: number, limit: number, order: ListOrder): Promise<MusicAlbumPage> {
  if (view.access.mode === "none") return { items: [], total: 0, cursor: null };
  const visible = visibleIds(view, await orderedIds("album", order));
  const rows = await visibleInOrder(view, visible.slice(offset, offset + limit));
  return { items: await albumsOf(view, rows), total: visible.length, cursor: nextCursor(offset, limit, visible.length) };
}

export async function artistsPageView(view: UserView, offset: number, limit: number): Promise<MusicArtistPage> {
  if (view.access.mode === "none") return { items: [], total: 0, cursor: null };
  const visible = visibleIds(view, await orderedIds("artist", "name"));
  const rows = await visibleInOrder(view, visible.slice(offset, offset + limit));
  return { items: artistsOf(rows, view), total: visible.length, cursor: nextCursor(offset, limit, visible.length) };
}

export async function albumView(view: UserView, albumId: string): Promise<MusicAlbum | null> {
  const id = normalizeId(albumId);
  const row = await rowById(id);
  if (!row || row.kind !== "album" || visibleRows(view, [row]).length === 0) return null;
  const [[album], tracks, description] = await Promise.all([
    albumsOf(view, [row]),
    albumTracks(id).then((rows) => tracksOf(view, visibleRows(view, rows))),
    albumDescription(view.userId, id),
  ]);
  const durationMs = tracks.reduce((sum, t) => sum + (t.durationMs ?? 0), 0) || album!.durationMs;
  return { ...album!, trackCount: tracks.length, durationMs, description, tracks };
}

/** Les titres que CE compte écoute le plus chez cet artiste (Jellyfin juge : droits, écoutes). */
async function topTrackIds(userId: string, artistId: string): Promise<string[] | null> {
  const result = await jfAdmin<JfItemsPage>(
    `/Items?userId=${q(userId)}&ArtistIds=${q(artistId)}&IncludeItemTypes=Audio&Recursive=true&SortBy=PlayCount,SortName&SortOrder=Descending,Ascending&Limit=10&Fields=&EnableImages=false`,
  );
  return result.ok ? (result.data.Items ?? []).map((i) => normalizeId(i.Id)) : null;
}

export async function artistView(view: UserView, artistId: string): Promise<MusicArtistResponse | null> {
  const id = normalizeId(artistId);
  const row = await rowById(id);
  if (!row || row.kind !== "artist" || visibleRows(view, [row]).length === 0) return null;
  const [albumsRows, top] = await Promise.all([creditedTo(id, "album"), topTrackIds(view.userId, id)]);
  const topRows = top ? await visibleInOrder(view, top) : visibleRows(view, await creditedTo(id, "track")).slice(0, 10);
  const [artist] = artistsOf([row], view);
  return { ...artist!, topTracks: await tracksOf(view, topRows), albums: await albumsOf(view, visibleRows(view, albumsRows)) };
}
