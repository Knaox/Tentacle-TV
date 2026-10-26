/**
 * Octave — ce qui dépend de l'écoute d'UN compte : l'accueil (récents,
 * ajouts, souvent écoutés), « Titres likés » (= ses favoris Jellyfin) et la
 * recherche par MBID d'enregistrement. Jellyfin dit l'ordre des écoutes
 * (identifiants seuls), l'index dit le reste.
 */

import type { MusicByMbidResponse, MusicHomeResponse, MusicLikedPage } from "../contract/musicCoreApi";
import { normalizeMbid } from "../contract/musicKeys";
import { orderedIds, rowsByIds, tracksByRecording } from "../index/indexQueries";
import type { IndexRow } from "../index/indexTypes";
import { jfAdmin, normalizeId, q, type JfItemsPage } from "../jellyfin/musicJellyfin";
import { forYouView } from "./homeForYou";
import { sortListItems, type MusicListStats } from "../contract/musicListOrder";
import { addedDatesFor, likedScope } from "../listOrder/addedDates";
import { readListPrefs } from "../listOrder/listPrefsStore";
import { likedPlayStats } from "../listOrder/playStats";
import { rowSubject } from "../listOrder/rowSubject";
import { playlistsView } from "./playlistViews";
import { albumsOf, nextCursor, tracksOf, visibleIds, visibleInOrder, visibleRows, type UserView } from "./viewContext";

const HOME_ROW = 20;
/** Les suggestions lisent une histoire plus longue que la rangée « Écoutés récemment ». */
const HISTORY_ROWS = 100;

async function playedIds(view: UserView, sortBy: string, limit = HOME_ROW): Promise<string[]> {
  if (view.access.mode === "none") return [];
  const result = await jfAdmin<JfItemsPage>(
    `/Items?userId=${q(view.userId)}&ParentId=${q(view.access.libraryId)}&Recursive=true&IncludeItemTypes=Audio&Filters=IsPlayed&SortBy=${sortBy}&SortOrder=Descending&Limit=${limit}&Fields=&EnableImages=false`,
  );
  return result.ok ? (result.data.Items ?? []).map((i) => normalizeId(i.Id)) : [];
}

export async function homeView(view: UserView): Promise<MusicHomeResponse> {
  if (view.access.mode === "none") return { recentlyPlayed: [], recentlyAdded: [], mostPlayed: [], playlists: [] };
  const [recentIds, mostIds, albumIds, playlists] = await Promise.all([
    playedIds(view, "DatePlayed", HISTORY_ROWS),
    playedIds(view, "PlayCount,DatePlayed"),
    orderedIds("album", "recent"),
    playlistsView(view),
  ]);
  const visibleAlbums = visibleIds(view, albumIds);
  const [history, most, added] = await Promise.all([
    visibleInOrder(view, recentIds),
    visibleInOrder(view, mostIds),
    visibleInOrder(view, visibleAlbums.slice(0, HOME_ROW)),
  ]);
  const recent = history.slice(0, HOME_ROW);
  return {
    recentlyPlayed: await tracksOf(view, recent),
    recentlyAdded: await albumsOf(view, added),
    mostPlayed: await tracksOf(view, most),
    playlists,
    forYou: await forYouView(view, { recent: history, most, day: new Date().toISOString().slice(0, 10) }),
  };
}

/** L'ordre de départ des likés (avant les dates d'entrée) : artiste de l'album, album, disque, piste. */
export function likedOrder(a: IndexRow, b: IndexRow): number {
  return (
    (a.albumArtist ?? "").localeCompare(b.albumArtist ?? "") ||
    (a.albumName ?? "").localeCompare(b.albumName ?? "") ||
    (a.discNumber ?? 1) - (b.discNumber ?? 1) ||
    (a.trackNumber ?? 9999) - (b.trackNumber ?? 9999) ||
    a.sortName.localeCompare(b.sortName)
  );
}

/**
 * Les likés dans l'ORDRE de la préférence du compte (`music.listOrder`) : chaque page est le début de la
 * liste que le client affiche. L'ordre naturel est le dernier like en tête (Tentacle date les likes,
 * `listOrder/addedDates.ts`) ; `stats` dit à chaque titre de la page son entrée et ses écoutes.
 */
export async function likedView(view: UserView, offset: number, limit: number): Promise<MusicLikedPage> {
  if (view.access.mode === "none" || view.favorites.size === 0) return { items: [], total: 0, cursor: null };
  const libraryId = view.access.libraryId;
  const rows = visibleRows(view, (await rowsByIds([...view.favorites])).values())
    .filter((r) => r.kind === "track")
    .sort(likedOrder);
  const libraryDate = new Map(rows.map((r) => [r.id, r.dateCreated]));
  const [prefs, plays, added] = await Promise.all([
    readListPrefs(view.userId, "liked"),
    likedPlayStats(view.userId, libraryId),
    addedDatesFor(likedScope(view.userId), rows.map((r) => r.id), (id) => libraryDate.get(id) ?? null),
  ]);
  const stats = new Map<string, MusicListStats>(rows.map((r) => [r.id, { addedAt: added.get(r.id) ?? null, ...(plays.get(r.id) ?? { plays: 0, lastPlayedAt: null }) }]));
  const subject = (r: IndexRow) => rowSubject(r, stats.get(r.id) ?? null);
  const natural = sortListItems(rows, subject, { sort: "added", direction: "desc", custom: null });
  const ordered = sortListItems(natural, subject, prefs);
  const page = ordered.slice(offset, offset + limit);
  return {
    items: await tracksOf(view, page),
    total: ordered.length,
    cursor: nextCursor(offset, page.length, ordered.length),
    stats: Object.fromEntries(page.map((r) => [r.id, stats.get(r.id)!])),
  };
}

export async function byMbidView(view: UserView, recordings: unknown[]): Promise<MusicByMbidResponse> {
  const mbids = [...new Set(recordings.map(normalizeMbid).filter((m): m is string => m !== null))].slice(0, 200);
  if (mbids.length === 0 || view.access.mode === "none") return { matches: [] };
  const rows = visibleRows(view, await tracksByRecording(mbids));
  const tracks = await tracksOf(view, rows);
  return {
    matches: tracks.map((track) => ({ recording: track.mbids.recording!, jellyfinId: track.jellyfinId!, track })),
  };
}
