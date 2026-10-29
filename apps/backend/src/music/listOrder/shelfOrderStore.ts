/**
 * Octave — l'ORDRE PERSONNEL d'une rubrique de la bibliothèque (albums, artistes, playlists), par compte, dans la
 * même table que l'ordre des listes de titres (`music_list_prefs`, clé `library:<rubrique>`, tri `custom`).
 */

import { getPrisma } from "../../services/db";
import { MUSIC_SHELF_ORDER_MAX, shelfListKey, type MusicShelfSection } from "../contract/musicLibraryShelves";

const account = (userId: string) => userId.replace(/-/g, "").toLowerCase();

export async function readShelfOrder(userId: string, section: MusicShelfSection): Promise<string[]> {
  const row = await getPrisma().musicListPrefs.findUnique({ where: { userId_listKey: { userId: account(userId), listKey: shelfListKey(section) } } });
  if (!row?.customJson) return [];
  try {
    const keys: unknown = JSON.parse(row.customJson);
    return Array.isArray(keys) ? keys.filter((k): k is string => typeof k === "string").slice(0, MUSIC_SHELF_ORDER_MAX) : [];
  } catch {
    return [];
  }
}

export async function writeShelfOrder(userId: string, section: MusicShelfSection, keys: readonly string[]): Promise<void> {
  const data = { sort: "custom", direction: "asc", customJson: JSON.stringify(keys) };
  await getPrisma().musicListPrefs.upsert({
    where: { userId_listKey: { userId: account(userId), listKey: shelfListKey(section) } },
    create: { userId: account(userId), listKey: shelfListKey(section), ...data },
    update: data,
  });
}
