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
  /** Change quand la playlist est réenregistrée (ajout, retrait, déplacement) : le tampon de sa jaquette. */
  Etag?: string;
  /** Tentacle, pas Jellyfin : lue pour un MEMBRE au nom de ce propriétaire (`playlistMembers/playlistAccess.ts`). */
  TentacleReaderId?: string;
}

/** Les playlists AUDIO que Jellyfin montre à ce compte (les siennes, partagées, publiques). */
export async function listUserPlaylists(userId: string): Promise<JfPlaylist[]> {
  const key = normalizeId(userId);
  const memo = listMemo.get(key);
  if (memo && Date.now() - memo.at < LIST_TTL_MS) return memo.items;
  const result = await jfAdmin<JfItemsPage>(
    `/Items?userId=${q(userId)}&IncludeItemTypes=Playlist&Recursive=true&SortBy=SortName&Fields=ChildCount,CanDelete,CumulativeRunTimeTicks,Etag,Path&EnableImages=true&ImageTypeLimit=1&EnableUserData=false`,
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
  const result = await jfAdmin<JfPlaylist>(`/Items/${q(playlistId)}?userId=${q(userId)}&Fields=ChildCount,CanDelete,CumulativeRunTimeTicks,Overview,Etag,Path`);
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

/**
 * L'image `Primary` a-t-elle été POSÉE À LA MAIN ? Mesuré sur Jellyfin 10.11 (28/10) : une image envoyée
 * (`POST /Items/{id}/Images/Primary`) s'écrit DANS le dossier de la playlist (`…/playlists/<Nom>/folder.<ext>`) et
 * Jellyfin ne l'écrase plus jamais ; son collage automatique vit dans ses métadonnées
 * (`…/metadata/library/xx/<id>/poster.png`). Aucun autre champ ne les distingue (ni drapeau, ni verrou), et seul
 * `/Items/{id}/Images` rend ce chemin. Jamais l'extension : une image manuelle peut être un PNG.
 */
export function isHandPlacedImage(playlistPath: string | undefined, imagePath: string | undefined): boolean {
  if (!playlistPath || !imagePath) return false;
  const folder = playlistPath.replace(/[\\/]+$/, "");
  return imagePath.length > folder.length + 1 && imagePath.startsWith(folder) && /[\\/]/.test(imagePath[folder.length]!);
}

/** `true` : la playlist garde l'image qu'on lui a posée ; `null` si Jellyfin ne répond pas. Une requête : à garder. */
export async function playlistHasHandPlacedImage(item: JfPlaylist): Promise<boolean | null> {
  if (!item.ImageTags?.Primary) return false;
  const result = await jfAdmin<{ ImageType?: string; Path?: string }[]>(`/Items/${q(item.Id)}/Images`);
  if (!result.ok) return null;
  const primary = (result.data ?? []).find((image) => image.ImageType === "Primary");
  return isHandPlacedImage(item.Path, primary?.Path);
}

export function resetPlaylistMemoForTests(): void {
  listMemo.clear();
}
