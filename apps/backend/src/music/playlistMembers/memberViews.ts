/**
 * Octave — ce qu'une playlist partagée ajoute aux vues d'un compte : les playlists partagées AVEC lui (lues au
 * nom de leur propriétaire), le partage de chacune (`sharing`), et SES écoutes dans une playlist d'un autre
 * (Jellyfin les rend au nom du compte qui lit la playlist : le propriétaire).
 */

import { jfAdmin, normalizeId, q, type JfItemsPage } from "../jellyfin/musicJellyfin";
import { listUserPlaylists, type JfPlaylist } from "../playlists/playlistJellyfin";
import { chunks } from "../playlists/playlistOrder";
import { playStatsOf, type PlayStats } from "../listOrder/playStats";
import type { MusicPlaylistSharing } from "../contract/musicPlaylistMembers";
import { membersEnabled, type PlaylistAccess } from "./playlistAccess";
import { idOf, membersOf, membersOfMany, membershipsOf } from "./memberStore";
import { peopleIndex, sharingOf } from "./memberPeople";

export interface SharedListing {
  /** Les playlists d'autres comptes partagées avec ce compte (lues au nom de leur propriétaire). */
  received: JfPlaylist[];
  /** Le partage de chaque playlist de la liste qui en a un (identifiant normalisé). */
  sharing: Map<string, MusicPlaylistSharing>;
}

/** Les playlists du compte (`own`, Jellyfin) complétées de celles qu'on lui partage, et du partage de chacune. */
export async function sharedListing(userId: string, own: readonly JfPlaylist[]): Promise<SharedListing> {
  const empty: SharedListing = { received: [], sharing: new Map() };
  if (!membersEnabled()) return empty;
  try {
    const me = idOf(userId);
    const memberships = await membershipsOf(me);
    const owned = own.filter((p) => p.CanDelete === true).map((p) => normalizeId(p.Id));
    const [ownMembers, index] = await Promise.all([membersOfMany(owned), peopleIndex()]);
    const sharing = new Map<string, MusicPlaylistSharing>();
    for (const id of owned) {
      const shown = sharingOf({ right: "owner", readerId: me }, ownMembers.get(id) ?? [], index);
      if (shown) sharing.set(id, shown);
    }
    const received: JfPlaylist[] = [];
    for (const m of memberships) {
      // La liste du propriétaire est gardée une minute : une requête par propriétaire, pas par playlist.
      const item = (await listUserPlaylists(m.ownerUserId)).find((p) => normalizeId(p.Id) === m.playlistId && p.CanDelete === true);
      if (!item) continue;
      received.push({ ...item, TentacleReaderId: m.ownerUserId });
      const shown = sharingOf({ right: m.right, readerId: m.ownerUserId }, await membersOf(m.playlistId), index);
      if (shown) sharing.set(m.playlistId, shown);
    }
    return { received, sharing };
  } catch {
    // Une base muette : les playlists du compte, comme avant.
    return empty;
  }
}

/** Le partage d'UNE playlist pour le compte qui lit ; `undefined` s'il n'y en a pas. */
export async function sharingFor(access: PlaylistAccess, playlistId: string, options: { evenUnshared?: boolean } = {}): Promise<MusicPlaylistSharing | undefined> {
  if (!membersEnabled() || access.right === null) return undefined;
  const [members, index] = await Promise.all([membersOf(playlistId).catch(() => []), peopleIndex()]);
  return sharingOf(access, members, index, options);
}

/** Les écoutes de CE compte pour ces titres (Jellyfin `UserData`) ; une carte vide si Jellyfin est muet. */
export async function playStatsFor(userId: string, itemIds: readonly string[]): Promise<Map<string, PlayStats>> {
  const out = new Map<string, PlayStats>();
  for (const batch of chunks([...new Set(itemIds)], 100)) {
    const result = await jfAdmin<JfItemsPage>(`/Items?userId=${q(userId)}&Ids=${batch.map(q).join(",")}&Fields=&EnableImages=false&EnableUserData=true`);
    if (!result.ok) return out;
    for (const item of result.data.Items ?? []) if (item.Id) out.set(normalizeId(item.Id), playStatsOf(item));
  }
  return out;
}
