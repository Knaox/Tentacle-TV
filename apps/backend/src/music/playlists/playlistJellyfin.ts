/**
 * Octave — les playlists TELLES QUE JELLYFIN LES TIENT : la liste d'un compte,
 * les entrées d'une playlist, et le droit d'y toucher.
 *
 * Le droit : `CanDelete` de `/Items/{id}?userId=` — vrai pour le propriétaire,
 * faux pour un autre compte (relevé du banc). La clé d'administration retire
 * des entrées SANS contrôle de propriétaire (204 pour n'importe qui) : le cœur
 * vérifie donc ce droit AVANT toute écriture, jamais après.
 */

import { jfAdmin, normalizeId, q, type JfItem, type JfItemsPage } from "../jellyfin/musicJellyfin";
import type { PlaylistEntryRef } from "./playlistOrder";
import { playStatsOf, type PlayStats } from "../listOrder/playStats";

const LIST_TTL_MS = 60_000;
const listMemo = new Map<string, { at: number; items: JfItem[] }>();

export interface JfPlaylist extends JfItem {
  CumulativeRunTimeTicks?: number;
}

/** Les playlists AUDIO que Jellyfin montre à ce compte (les siennes, partagées, publiques). */
export async function listUserPlaylists(userId: string): Promise<JfPlaylist[]> {
  const key = normalizeId(userId);
  const memo = listMemo.get(key);
  if (memo && Date.now() - memo.at < LIST_TTL_MS) return memo.items;
  const result = await jfAdmin<JfItemsPage>(
    `/Items?userId=${q(userId)}&IncludeItemTypes=Playlist&Recursive=true&SortBy=SortName&Fields=ChildCount,CanDelete,CumulativeRunTimeTicks&EnableImages=true&ImageTypeLimit=1&EnableUserData=false`,
  );
  if (!result.ok) return memo?.items ?? [];
  const items = (result.data.Items ?? []).filter((p) => !p.MediaType || p.MediaType === "Audio");
  listMemo.set(key, { at: Date.now(), items });
  return items;
}

export function forgetUserPlaylists(userId?: string): void {
  if (userId === undefined) listMemo.clear();
  else listMemo.delete(normalizeId(userId));
}

/** La playlist vue PAR ce compte ; `null` s'il ne la voit pas (404 de Jellyfin), ou si ce n'en est pas une. */
export async function playlistFor(userId: string, playlistId: string): Promise<JfPlaylist | null> {
  const result = await jfAdmin<JfPlaylist>(`/Items/${q(playlistId)}?userId=${q(userId)}&Fields=ChildCount,CanDelete,CumulativeRunTimeTicks,Overview`);
  if (!result.ok || result.data.Type !== "Playlist") return null;
  return result.data;
}

/** Une entrée, et les écoutes du compte qui la lit (pour trier). */
export interface PlaylistEntryRead extends PlaylistEntryRef {
  plays: PlayStats;
}

/** Les entrées, dans l'ordre de Jellyfin, avec les écoutes du compte ; `null` si Jellyfin ne répond pas. */
export async function playlistEntries(userId: string, playlistId: string): Promise<PlaylistEntryRead[] | null> {
  const result = await jfAdmin<JfItemsPage>(
    `/Playlists/${q(playlistId)}/Items?userId=${q(userId)}&Fields=&EnableImages=false&EnableUserData=true`,
  );
  if (!result.ok) return null;
  return (result.data.Items ?? [])
    .filter((i) => i.Id)
    .map((i) => ({ entryId: i.PlaylistItemId ?? i.Id, itemId: normalizeId(i.Id), plays: playStatsOf(i) }));
}

export function resetPlaylistMemoForTests(): void {
  listMemo.clear();
}
