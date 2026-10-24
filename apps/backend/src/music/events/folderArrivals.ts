/**
 * Octave — ce qui vient d'arriver, indexé SANS attendre `LibraryChanged`.
 *
 * Jellyfin retarde son évènement de `LibraryUpdateDuration` (30 s par défaut) :
 * mesuré par A7, l'élément était visible dans Jellyfin 30 s avant que l'index
 * du cœur (donc `findByMbid`, donc le favori posé par une extension) le
 * connaisse. Deux voies, sans aucun relevé périodique :
 *
 * 1. après un `refreshPath` réussi, le dossier rafraîchi est relu jusqu'à ce
 *    que ses éléments neufs paraissent (15 s au plus), puis indexés et
 *    annoncés (`music:library`, `jellyfin.audioItems`) ;
 * 2. `findByMbid` qui ne trouve pas un MBID relit les dossiers rafraîchis ces
 *    dix dernières minutes et les cent derniers titres ajoutés (une fois par
 *    seconde au plus, les appels simultanés se rejoignent).
 *
 * Tout passe par `applyLibraryChange` dans la file des évènements : quand
 * `LibraryChanged` arrive ensuite, ces éléments sont connus et déjà annoncés
 * (`recentArrivals.ts`) — rien n'est redit.
 */

import { adminUserParam } from "../../services/jellyfinLibrary";
import { rowsByIds } from "../index/indexQueries";
import { applyLibraryChange, type IncrementalResult } from "../index/indexSync";
import { jfAdmin, normalizeId, q, type JfItemsPage } from "../jellyfin/musicJellyfin";
import { getMusicLibrary } from "../jellyfin/musicLibrary";
import { runSerialized, tellLibrary } from "./musicLiveEvents";

const RECENT_FOLDER_MS = 10 * 60_000;
const MAX_FOLDERS = 20;
const RECENT_LIMIT = 100;
const LOOKUP_EVERY_MS = 1_000;
export const ARRIVAL_TIMEOUT_MS = 15_000;

const recentFolders = new Map<string, number>();
let lastLookup = 0;
let lookup: Promise<void> | null = null;

export interface ArrivalClock {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

const REAL: ArrivalClock = { now: Date.now, sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) };

function noteFolder(folderId: string, now: number): void {
  recentFolders.delete(folderId);
  recentFolders.set(folderId, now);
  for (const [id, at] of recentFolders) if (now - at > RECENT_FOLDER_MS || recentFolders.size > MAX_FOLDERS) recentFolders.delete(id);
}

async function idsOf(path: string): Promise<string[] | null> {
  const result = await jfAdmin<JfItemsPage>(`${path}&Fields=&EnableImages=false&EnableUserData=false${await adminUserParam()}`);
  return result.ok ? (result.data.Items ?? []).map((item) => normalizeId(item.Id)) : null;
}

function idsUnder(folderId: string): Promise<string[] | null> {
  return idsOf(`/Items?ParentId=${q(folderId)}&Recursive=true&IncludeItemTypes=Audio,MusicAlbum`);
}

async function unknownAmong(ids: readonly string[]): Promise<string[]> {
  const known = await rowsByIds(ids);
  return ids.filter((id) => !known.has(id));
}

/** Indexe et annonce `ids` (dans la file des évènements) ; rend ce qui a été appliqué. */
function indexNow(ids: string[]): Promise<IncrementalResult | null> {
  let applied: IncrementalResult | null = null;
  return runSerialized(async () => {
    const still = await unknownAmong(ids);
    if (still.length === 0) return;
    applied = await applyLibraryChange(still, [], []);
    if (applied && applied.added.length > 0) await tellLibrary(applied);
  }).then(() => applied);
}

/**
 * Après le rafraîchissement d'un dossier : ses éléments neufs, dès qu'ils
 * paraissent et que leur liste ne bouge plus d'une lecture à la suivante.
 */
export async function indexArrivalsUnder(folderId: string, clock: ArrivalClock = REAL): Promise<IncrementalResult | null> {
  const start = clock.now();
  noteFolder(normalizeId(folderId), start);
  let previous = "";
  for (let step = 0; clock.now() - start < ARRIVAL_TIMEOUT_MS; step++) {
    await clock.sleep(step < 12 ? 250 : 1_000);
    const ids = await idsUnder(folderId);
    if (ids === null) continue;
    const unknown = await unknownAmong(ids);
    const key = unknown.join(",");
    if (unknown.length > 0 && key === previous) return indexNow(unknown);
    previous = key;
  }
  return null;
}

async function lookupArrivals(): Promise<void> {
  const library = await getMusicLibrary();
  if (!library) return;
  const lists = await Promise.all([
    ...[...recentFolders.keys()].map(idsUnder),
    idsOf(`/Items?ParentId=${q(library.libraryId)}&Recursive=true&IncludeItemTypes=Audio,MusicAlbum&SortBy=DateCreated&SortOrder=Descending&Limit=${RECENT_LIMIT}`),
  ]);
  const unknown = await unknownAmong([...new Set(lists.flatMap((ids) => ids ?? []))]);
  if (unknown.length > 0) await indexNow(unknown);
}

/**
 * Le filet de `findByMbid` : l'index ne connaît pas encore un MBID demandé.
 * Borné (dossiers récents + cent derniers ajouts), une fois par seconde au plus.
 */
export function lookupRecentArrivals(now = Date.now()): Promise<void> {
  if (lookup) return lookup;
  if (now - lastLookup < LOOKUP_EVERY_MS) return Promise.resolve();
  lastLookup = now;
  lookup = lookupArrivals()
    .catch(() => undefined)
    .finally(() => {
      lookup = null;
    });
  return lookup;
}

export function resetFolderArrivalsForTests(): void {
  recentFolders.clear();
  lastLookup = 0;
  lookup = null;
}
