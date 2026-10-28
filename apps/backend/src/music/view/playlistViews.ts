/**
 * Octave — les playlists d'un compte au format du contrat. Une entrée dont
 * l'élément n'est pas (ou plus) dans la bibliothèque musique VISIBLE du compte
 * n'est pas montrée — sa POSITION reste celle de Jellyfin, pour que déplacer
 * ou insérer vise le bon rang.
 */

import type { MusicPlaylistDetail } from "../contract/musicCoreApi";
import type { MusicPlaylist, MusicPlaylistEntry } from "../contract/musicTypes";
import { normalizeId } from "../jellyfin/musicJellyfin";
import { artworkUrl } from "../model/toMusic";
import { listUserPlaylists, playlistEntries, playlistFor, type JfPlaylist } from "../playlists/playlistJellyfin";
import { searchTokens } from "../index/searchQuery";
import { addedDatesFor, legacyPlaylistScope, playlistScope } from "../listOrder/addedDates";
import { tracksOf, visibleInOrder, type UserView } from "./viewContext";
import { pinnedDates, ranksByItem } from "../playlistSource/sourceRecord";
import { readPlaylistSource } from "../playlistSource/sourceStore";
import { mosaicCandidatesFor, rememberMosaic, withMosaic } from "./playlistMosaic";

export function toPlaylist(item: JfPlaylist): MusicPlaylist {
  const ticks = item.CumulativeRunTimeTicks ?? item.RunTimeTicks;
  const tag = item.ImageTags?.Primary;
  return {
    jellyfinId: normalizeId(item.Id),
    name: item.Name ?? "",
    trackCount: item.ChildCount ?? 0,
    durationMs: typeof ticks === "number" && ticks > 0 ? Math.round(ticks / 10_000) : null,
    artworkUrl: tag ? artworkUrl(`${normalizeId(item.Id)}/${tag}`) : null,
    editable: item.CanDelete === true,
  };
}

/** Les playlists du compte, chacune avec sa jaquette du jour (`playlistMosaic.ts` : aucune relecture au repos). */
export async function playlistsView(view: UserView): Promise<MusicPlaylist[]> {
  if (view.access.mode === "none") return [];
  const items = await listUserPlaylists(view.userId);
  const candidates = await mosaicCandidatesFor(view, items);
  const now = Date.now();
  return items.map((item) => withMosaic(toPlaylist(item), candidates.get(normalizeId(item.Id)), now));
}

/** Les playlists dont le nom répond à la frappe (chaque mot est un préfixe d'un mot du nom). */
export async function searchPlaylists(view: UserView, query: string, limit: number): Promise<MusicPlaylist[]> {
  const wanted = searchTokens(query);
  if (wanted.length === 0) return [];
  const all = await playlistsView(view);
  return all
    .filter((p) => {
      const words = searchTokens(p.name.normalize("NFD").replace(/\p{M}/gu, ""));
      return wanted.every((w) => words.some((word) => word.startsWith(w.normalize("NFD").replace(/\p{M}/gu, ""))));
    })
    .slice(0, limit);
}

export async function playlistDetail(view: UserView, playlistId: string): Promise<MusicPlaylistDetail | null> {
  if (view.access.mode === "none") return null;
  const playlist = await playlistFor(view.userId, playlistId);
  if (!playlist) return null;
  const entries = (await playlistEntries(view.userId, playlistId)) ?? [];
  const ids = entries.map((e) => e.itemId);
  const rows = await visibleInOrder(view, ids);
  const ordered = await tracksOf(view, rows);
  const tracks = new Map(ordered.map((t) => [t.jellyfinId!, t]));
  // Jellyfin ne date pas une entrée : Tentacle relève quand elle est apparue (l'ordre de la playlist à la première
  // lecture) ; une arrivée posée à la place de son attente garde la date de sa place. Une playlist IMPORTÉE : un
  // titre de la source a la date de son rang dans la source (l'ordre des ajouts chez Apple Music).
  const source = await readPlaylistSource(playlistId).catch(() => null);
  const ranks = source ? ranksByItem(source) : new Map<string, number>();
  const pinned = source ? pinnedDates(source, ids) : undefined;
  const added = await addedDatesFor(playlistScope(playlistId), ids, undefined, { ordered: true, legacyScope: legacyPlaylistScope(playlistId), pinned });
  const out: MusicPlaylistEntry[] = [];
  entries.forEach((entry, position) => {
    const track = tracks.get(entry.itemId);
    const rank = ranks.get(entry.itemId);
    if (track) out.push({ entryId: entry.entryId, position, track, stats: { addedAt: added.get(entry.itemId) ?? null, ...entry.plays }, ...(rank !== undefined ? { sourceIndex: rank } : {}) });
  });
  // La jaquette de l'en-tête est celle des cartes : mêmes titres, même jour (et la liste suivante n'a rien à relire).
  const place = await rememberMosaic(view, playlist, ordered);
  return { ...withMosaic(toPlaylist(playlist), place), cover: place, description: playlist.Overview?.trim() || null, entries: out };
}
