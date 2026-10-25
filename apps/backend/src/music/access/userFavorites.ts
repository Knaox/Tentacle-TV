/**
 * Octave — le CŒUR d'un compte, c'est son favori Jellyfin (contrat : aucun
 * stockage propre). On garde en mémoire l'ensemble des favoris musique de
 * chaque compte, relevé une fois, puis tenu à jour par les évènements
 * `UserDataChanged` de ses sockets (`applyFavoriteChanges`) et par nos propres
 * écritures — jamais par un relevé périodique ; dix minutes au plus sans
 * évènement, il est relu à la demande suivante.
 */

import { jfAdmin, jfWrite, normalizeId, q, type JfItemsPage } from "../jellyfin/musicJellyfin";

const TTL_MS = 10 * 60_000;
const PAGE = 2000;

const memo = new Map<string, { at: number; ids: Set<string> }>();
const inflight = new Map<string, Promise<Set<string> | null>>();

async function load(userId: string, libraryId: string): Promise<Set<string> | null> {
  const common = `userId=${q(userId)}&ParentId=${q(libraryId)}&IsFavorite=true&Fields=&EnableImages=false&EnableUserData=false`;
  const ids = new Set<string>();
  for (const path of [`/Items?${common}&Recursive=true&IncludeItemTypes=Audio,MusicAlbum`, `/Artists?${common}`]) {
    for (let start = 0; ; start += PAGE) {
      const result = await jfAdmin<JfItemsPage>(`${path}&StartIndex=${start}&Limit=${PAGE}`, { timeoutMs: 30_000 });
      if (!result.ok) return null;
      const items = result.data.Items ?? [];
      for (const item of items) if (item.Id) ids.add(normalizeId(item.Id));
      if (items.length < PAGE) break;
    }
  }
  return ids;
}

/** Les favoris musique du compte ; un ensemble VIDE si Jellyfin est muet (rien n'est inventé). */
export async function getFavorites(userId: string, libraryId: string): Promise<ReadonlySet<string>> {
  const key = normalizeId(userId);
  const known = memo.get(key);
  if (known && Date.now() - known.at < TTL_MS) return known.ids;
  let running = inflight.get(key);
  if (!running) {
    running = load(userId, libraryId).finally(() => inflight.delete(key));
    inflight.set(key, running);
  }
  const ids = await running;
  if (!ids) return known?.ids ?? new Set();
  memo.set(key, { at: Date.now(), ids });
  return ids;
}

/** Ce qu'on sait du cœur de ce compte sur cet élément ; `undefined` : pas encore relevé. */
export function knownFavorite(userId: string, itemId: string): boolean | undefined {
  const entry = memo.get(normalizeId(userId));
  return entry ? entry.ids.has(normalizeId(itemId)) : undefined;
}

/** Des favoris ont changé pour ce compte (évènement Jellyfin ou écriture du cœur). */
export function applyFavoriteChanges(userId: string, changes: readonly { jellyfinId: string; favorite: boolean }[]): void {
  const entry = memo.get(normalizeId(userId));
  if (!entry) return;
  for (const change of changes) {
    const id = normalizeId(change.jellyfinId);
    if (change.favorite) entry.ids.add(id);
    else entry.ids.delete(id);
  }
}

/** Pose ou retire le favori Jellyfin (clé + `userId` : Jellyfin l'écrit pour CE compte). */
export async function writeFavorite(userId: string, itemId: string, favorite: boolean): Promise<boolean> {
  const result = await jfWrite(`/UserFavoriteItems/${q(itemId)}?userId=${q(userId)}`, favorite ? "POST" : "DELETE");
  if (result.ok) applyFavoriteChanges(userId, [{ jellyfinId: itemId, favorite }]);
  return result.ok;
}

export function resetFavoritesForTests(): void {
  memo.clear();
  inflight.clear();
}
