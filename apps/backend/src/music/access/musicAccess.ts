/**
 * Octave — ce qu'UN compte voit de la musique. Jellyfin décide, Tentacle ne
 * fait que lire sa politique (docs/DROITS-UTILISATEURS.md § 5) :
 *
 * - `none` : pas de bibliothèque musique, politique illisible (fermé à
 *   l'échec), compte désactivé, ou bibliothèque non permise / bloquée. Les
 *   listes sont vides, jamais une erreur qui trahirait leur existence.
 * - `all` : bibliothèque permise et AUCUNE restriction de contenu (ni note, ni
 *   étiquette, ni non classé) — tout l'index lui est visible, sans requête.
 * - `some` : restreint (contrôle parental, profil d'invité de la Famille…) —
 *   l'ensemble des identifiants que Jellyfin lui montre, relevé AU NOM du
 *   compte (sans `Ids` : avec une liste, Jellyfin oublie les bibliothèques),
 *   gardé dix minutes et vidé à chaque changement de politique ou d'index.
 */

import { getContentPolicy, onContentPolicyInvalidated } from "../../services/contentPolicy";
import { getMusicLibrary } from "../jellyfin/musicLibrary";
import { jfAdmin, normalizeId, q, type JfItemsPage } from "../jellyfin/musicJellyfin";

export type MusicAccess =
  | { mode: "none" }
  | { mode: "all"; libraryId: string }
  | { mode: "some"; libraryId: string; visible: ReadonlySet<string> };

const NONE: MusicAccess = { mode: "none" };
const PAGE = 2000;
const PAGES_MAX = 100;
const VISIBLE_TTL_MS = 10 * 60_000;

const visibleMemo = new Map<string, { at: number; ids: Set<string> }>();
const inflight = new Map<string, Promise<Set<string> | null>>();

onContentPolicyInvalidated((userId) => {
  if (userId === null) visibleMemo.clear();
  else visibleMemo.delete(normalizeId(userId));
});

/** L'index a changé (ajout, retrait) : les ensembles relevés ne sont plus complets. */
export function invalidateMusicVisibility(): void {
  visibleMemo.clear();
}

async function pagedIds(path: string): Promise<string[] | null> {
  const ids: string[] = [];
  for (let page = 0; page < PAGES_MAX; page++) {
    const result = await jfAdmin<JfItemsPage>(`${path}&StartIndex=${page * PAGE}&Limit=${PAGE}`, { timeoutMs: 30_000 });
    if (!result.ok) return null;
    const items = result.data.Items ?? [];
    for (const item of items) if (item.Id) ids.push(normalizeId(item.Id));
    if (items.length < PAGE) return ids;
  }
  return ids;
}

async function loadVisible(userId: string, libraryId: string): Promise<Set<string> | null> {
  const common = `userId=${q(userId)}&ParentId=${q(libraryId)}&Fields=&EnableImages=false&EnableUserData=false`;
  const [items, artists] = await Promise.all([
    pagedIds(`/Items?${common}&Recursive=true&IncludeItemTypes=Audio,MusicAlbum`),
    pagedIds(`/Artists?${common}`),
  ]);
  // Un relevé incomplet ne juge rien : fermé à l'échec.
  if (items === null || artists === null) return null;
  return new Set([...items, ...artists]);
}

async function visibleFor(userId: string, libraryId: string): Promise<Set<string> | null> {
  const key = normalizeId(userId);
  const memo = visibleMemo.get(key);
  if (memo && Date.now() - memo.at < VISIBLE_TTL_MS) return memo.ids;
  let running = inflight.get(key);
  if (!running) {
    running = loadVisible(userId, libraryId).finally(() => inflight.delete(key));
    inflight.set(key, running);
  }
  const ids = await running;
  if (ids) visibleMemo.set(key, { at: Date.now(), ids });
  return ids;
}

export async function getMusicAccess(userId: string): Promise<MusicAccess> {
  const library = await getMusicLibrary();
  if (!library) return NONE;
  const policy = await getContentPolicy(userId);
  if (!policy.readable || policy.isDisabled) return NONE;
  const lib = library.libraryId;
  const permitted = (policy.enableAllFolders || policy.enabledFolders.includes(lib)) && !policy.blockedMediaFolders.includes(lib);
  if (!permitted) return NONE;
  if (!policy.restricted) return { mode: "all", libraryId: lib };
  const visible = await visibleFor(userId, lib);
  return visible ? { mode: "some", libraryId: lib, visible } : NONE;
}

/** Un élément de l'INDEX est-il visible à ce compte ? (L'appelant a vérifié qu'il est dans l'index.) */
export function sees(access: MusicAccess, id: string): boolean {
  if (access.mode === "none") return false;
  return access.mode === "all" || access.visible.has(normalizeId(id));
}

export function filterVisible<T>(access: MusicAccess, items: readonly T[], idOf: (item: T) => string): T[] {
  if (access.mode === "none") return [];
  if (access.mode === "all") return [...items];
  return items.filter((item) => access.visible.has(normalizeId(idOf(item))));
}

export function resetMusicAccessForTests(): void {
  visibleMemo.clear();
  inflight.clear();
}
