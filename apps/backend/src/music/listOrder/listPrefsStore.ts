/**
 * Octave — le tri et l'ordre personnalisé d'une liste, par COMPTE
 * (`music_list_prefs`, contrat `musicListOrder.ts`). Rien de gardé : la
 * préférence par défaut de la liste.
 */

import { getPrisma } from "../../services/db";
import { defaultListPrefs, parseListPrefs, type MusicListKey, type MusicListPrefs } from "../contract/musicListOrder";

function account(userId: string): string {
  return userId.replace(/-/g, "").toLowerCase();
}

export async function readListPrefs(userId: string, key: MusicListKey): Promise<MusicListPrefs> {
  const row = await getPrisma().musicListPrefs.findUnique({ where: { userId_listKey: { userId: account(userId), listKey: key } } });
  if (!row) return defaultListPrefs(key);
  let custom: unknown;
  try {
    custom = row.customJson ? JSON.parse(row.customJson) : null;
  } catch {
    custom = null;
  }
  return parseListPrefs({ sort: row.sort, direction: row.direction, custom }) ?? defaultListPrefs(key);
}

export async function writeListPrefs(userId: string, key: MusicListKey, prefs: MusicListPrefs): Promise<void> {
  const data = { sort: prefs.sort, direction: prefs.direction, customJson: prefs.custom ? JSON.stringify(prefs.custom) : null };
  await getPrisma().musicListPrefs.upsert({
    where: { userId_listKey: { userId: account(userId), listKey: key } },
    create: { userId: account(userId), listKey: key, ...data },
    update: data,
  });
}

/** Une playlist supprimée : ses préférences et ses dates partent avec elle. */
export async function forgetPlaylistOrder(playlistId: string): Promise<void> {
  const id = playlistId.replace(/-/g, "").toLowerCase();
  const prisma = getPrisma();
  await prisma.musicListPrefs.deleteMany({ where: { listKey: `playlist:${id}` } });
  await prisma.musicListAdded.deleteMany({ where: { scope: `playlist:${id}` } });
}
