/**
 * Octave — les favoris de la bibliothèque que TENTACLE garde (`music_shelf_favorites`) : ceux d'une extension, et
 * les playlists reçues d'un autre compte. Les autres sont les favoris Jellyfin du compte.
 */

import { getPrisma } from "../../services/db";
import type { MusicShelfSection } from "../contract/musicLibraryShelves";

export interface StoredShelfFavorite {
  section: MusicShelfSection;
  itemKey: string;
  snapshotJson: string | null;
}

const account = (userId: string) => userId.replace(/-/g, "").toLowerCase();

export async function listShelfFavorites(userId: string): Promise<StoredShelfFavorite[]> {
  const rows = await getPrisma().musicShelfFavorite.findMany({ where: { userId: account(userId) }, orderBy: { createdAt: "desc" } });
  return rows.map((r) => ({ section: r.section as MusicShelfSection, itemKey: r.itemKey, snapshotJson: r.snapshotJson }));
}

export async function writeShelfFavorite(userId: string, section: MusicShelfSection, itemKey: string, favorite: boolean, snapshotJson: string | null): Promise<void> {
  const where = { userId_section_itemKey: { userId: account(userId), section, itemKey } };
  if (!favorite) {
    await getPrisma().musicShelfFavorite.deleteMany({ where: { userId: account(userId), section, itemKey } });
    return;
  }
  await getPrisma().musicShelfFavorite.upsert({ where, create: { userId: account(userId), section, itemKey, snapshotJson }, update: { snapshotJson } });
}

/** Une playlist supprimée : plus aucun compte ne la garde en favori. */
export async function forgetShelfPlaylist(playlistId: string): Promise<void> {
  const key = `jf:${playlistId.replace(/-/g, "").toLowerCase()}`;
  await getPrisma().musicShelfFavorite.deleteMany({ where: { section: "playlists", itemKey: key } });
}

/** Les playlists REÇUES que le compte garde en favori (Jellyfin ne les lui montre pas) : leurs identifiants. */
export async function receivedPlaylistFavorites(userId: string): Promise<Set<string>> {
  const rows = await getPrisma()
    .musicShelfFavorite.findMany({ where: { userId: account(userId), section: "playlists", itemKey: { startsWith: "jf:" } }, select: { itemKey: true } })
    .catch(() => []);
  return new Set(rows.map((r) => r.itemKey.slice(3)));
}
