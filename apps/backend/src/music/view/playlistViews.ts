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
import { listUserPlaylists, playlistEntries, type JfPlaylist } from "../playlists/playlistJellyfin";
import { searchTokens } from "../index/searchQuery";
import { addedDatesFor, legacyPlaylistScope, playlistScope } from "../listOrder/addedDates";
import { tracksOf, visibleInOrder, type UserView } from "./viewContext";
import { pinnedDates, ranksByItem } from "../playlistSource/sourceRecord";
import { readPlaylistSource } from "../playlistSource/sourceStore";
import { mosaicCandidatesFor, rememberMosaic, withMosaic } from "./playlistMosaic";
import { playlistAccess } from "../playlistMembers/playlistAccess";
import { playStatsFor, sharedListing, sharingFor } from "../playlistMembers/memberViews";

export function toPlaylist(item: JfPlaylist): MusicPlaylist {
  const ticks = item.CumulativeRunTimeTicks ?? item.RunTimeTicks;
  const tag = item.ImageTags?.Primary;
  return {
    jellyfinId: normalizeId(item.Id),
    name: item.Name ?? "",
    trackCount: item.ChildCount ?? 0,
    durationMs: typeof ticks === "number" && ticks > 0 ? Math.round(ticks / 10_000) : null,
    artworkUrl: tag ? artworkUrl(`${normalizeId(item.Id)}/${tag}`) : null,
    // Lue au nom du propriétaire pour un membre : jamais « gérable » par lui.
    editable: item.CanDelete === true && !item.TentacleReaderId,
  };
}

/** Les playlists du compte, chacune avec sa jaquette du jour (`playlistMosaic.ts` : aucune relecture au repos). */
export async function playlistsView(view: UserView): Promise<MusicPlaylist[]> {
  if (view.access.mode === "none") return [];
  const own = await listUserPlaylists(view.userId);
  // Les playlists partagées AVEC ce compte s'ajoutent aux siennes (une playlist publique qu'il est aussi membre : une fois).
  const { received, sharing } = await sharedListing(view.userId, own);
  const receivedIds = new Set(received.map((p) => normalizeId(p.Id)));
  const items = [...own.filter((p) => !receivedIds.has(normalizeId(p.Id))), ...received];
  const candidates = await mosaicCandidatesFor(view, items);
  const now = Date.now();
  return items.map((item) => {
    const id = normalizeId(item.Id);
    const playlist = withMosaic(toPlaylist(item), candidates.get(id), now);
    const shared = sharing.get(id);
    return shared ? { ...playlist, sharing: shared } : playlist;
  });
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
  const access = await playlistAccess(view.userId, playlistId);
  if (!access) return null;
  const { playlist, readerId } = access;
  const entries = (await playlistEntries(readerId, playlistId)) ?? [];
  const ids = entries.map((e) => e.itemId);
  // Lue au nom du propriétaire, Jellyfin rend SES écoutes : celles du membre se relisent à son nom.
  const ownPlays = readerId === normalizeId(view.userId) ? null : await playStatsFor(view.userId, ids);
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
    if (track) out.push({ entryId: entry.entryId, position, track, stats: { addedAt: added.get(entry.itemId) ?? null, ...(ownPlays ? (ownPlays.get(entry.itemId) ?? { plays: 0, lastPlayedAt: null }) : entry.plays) }, ...(rank !== undefined ? { sourceIndex: rank } : {}) });
  });
  // La jaquette de l'en-tête est celle des cartes : mêmes titres, même jour (et la liste suivante n'a rien à relire).
  const place = await rememberMosaic(view, playlist, ordered);
  const sharing = await sharingFor(access, playlistId);
  return { ...withMosaic(toPlaylist(playlist), place), ...(sharing ? { sharing } : {}), cover: place, description: playlist.Overview?.trim() || null, entries: out };
}
