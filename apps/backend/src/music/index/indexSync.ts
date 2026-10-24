/**
 * Octave — l'index suit Jellyfin : un passage COMPLET paginé (au démarrage),
 * puis les évènements `LibraryChanged` des sockets des comptes
 * (`services/jellyfinUserEvents.ts`) — jamais un relevé périodique.
 *
 * Appartenance à la bibliothèque musique : `Ids=` fait oublier `ParentId` à
 * Jellyfin (relevé du banc, 10.11) ; un élément d'un évènement est donc gardé
 * si son CHEMIN est sous un dossier de la bibliothèque musique. Les artistes
 * (chemin de métadonnées) entrent par les crédits des titres et des albums.
 */

import { adminUserParam } from "../../services/jellyfinLibrary";
import { setConfigValue } from "../../services/configStore";
import { invalidateMusicVisibility } from "../access/musicAccess";
import { publishAudioItems, type AudioItemRef } from "../events/audioItemsFeed";
import { recordingOf, rowFromItem } from "../jellyfin/itemMapping";
import { INDEX_FIELDS, jfAdmin, normalizeId, q, type JfItem, type JfItemsPage } from "../jellyfin/musicJellyfin";
import { getMusicLibrary, type MusicLibrary } from "../jellyfin/musicLibrary";
import { fillArtistMbids } from "./artistMbids";
import { albumTracks, orderedIds, rowsByIds } from "./indexQueries";
import { currentGeneration, dropOlderThan, removeRows, upsertRows } from "./indexStore";
import type { IndexRow } from "./indexTypes";

const PAGE = 500;
const IDS_BATCH = 100;

export interface SyncState {
  ready: boolean;
  running: boolean;
  lastFullAt: number | null;
  lastError: string | null;
}

const state: SyncState = { ready: false, running: false, lastFullAt: null, lastError: null };
let running: Promise<IncrementalResult | null> | null = null;

export function syncState(): Readonly<SyncState> {
  return state;
}

/** Un index rempli par une exécution précédente répond tout de suite, pendant le passage complet. */
export function markIndexUsable(): void {
  state.ready = true;
}

export function audioRef(item: JfItem): AudioItemRef {
  const ids = item.ProviderIds ?? {};
  return {
    jellyfinId: normalizeId(item.Id),
    recording: recordingOf(ids),
    release: ids.MusicBrainzAlbum?.toLowerCase() ?? null,
    path: item.Path ?? null,
  };
}

async function* pages(path: string): AsyncGenerator<JfItem[]> {
  for (let start = 0; ; start += PAGE) {
    const result = await jfAdmin<JfItemsPage>(`${path}&StartIndex=${start}&Limit=${PAGE}`, { timeoutMs: 60_000 });
    if (!result.ok) throw new Error(`Jellyfin ${result.failure}${result.status ? ` ${result.status}` : ""}`);
    const items = result.data.Items ?? [];
    yield items;
    if (items.length < PAGE) return;
  }
}

/** Ce qu'un passage complet a TROUVÉ de changé (serveur éteint, évènement manqué) ; `null` au tout premier. */
async function runFull(library: MusicLibrary): Promise<IncrementalResult | null> {
  const user = await adminUserParam();
  const before = new Set(await orderedIds("track", "name"));
  const knownIds = new Set(await allIndexedIds());
  const generation = (await currentGeneration()) + 1;
  const base = `ParentId=${q(library.libraryId)}&EnableImages=true&ImageTypeLimit=1&EnableUserData=false${user}`;
  const sources = [
    `/Artists?${base}&Fields=ProviderIds,SortName,DateCreated`,
    `/Items?${base}&Recursive=true&IncludeItemTypes=MusicAlbum&Fields=${INDEX_FIELDS}`,
    `/Items?${base}&Recursive=true&IncludeItemTypes=Audio&Fields=${INDEX_FIELDS}`,
  ];
  const added: AudioItemRef[] = [];
  const addedRows: IndexRow[] = [];
  for (const source of sources) {
    for await (const items of pages(source)) {
      const rows = items.map(rowFromItem).filter((r): r is IndexRow => r !== null);
      await upsertRows(rows, generation);
      for (const row of rows) if (!knownIds.has(row.id)) addedRows.push(row);
      for (const item of items) if (item.Type === "Audio" && !before.has(normalizeId(item.Id))) added.push(audioRef(item));
    }
  }
  const removed = await dropOlderThan(generation);
  await fillArtistMbids();
  // Le tout premier passage ne « voit » rien d'arrivé : il découvre ce qui était déjà là.
  if (knownIds.size === 0) return null;
  publishAudioItems({ added, updated: [], removed: removed.filter((id) => before.has(id)) });
  if (addedRows.length > 0 || removed.length > 0) invalidateMusicVisibility();
  return { added: addedRows, updated: [], removed, addedRefs: added, updatedRefs: [], playlists: [], unresolved: [] };
}

/** Un passage complet (un seul à la fois ; un second appel rejoint le premier). Rend ce qu'il a vu changer. */
export function fullSync(): Promise<IncrementalResult | null> {
  running ??= (async () => {
    state.running = true;
    let changes: IncrementalResult | null = null;
    try {
      const library = await getMusicLibrary();
      if (library) changes = await runFull(library);
      else {
        const removed = await removeRows(await allIndexedIds());
        if (removed.length > 0) changes = { added: [], updated: [], removed, addedRefs: [], updatedRefs: [], playlists: [], unresolved: [] };
      }
      state.ready = true;
      state.lastFullAt = Date.now();
      state.lastError = null;
      await setConfigValue("music_index_full_at", String(state.lastFullAt)).catch(() => undefined);
      console.log(`[music] index de la musique à jour (${library ? library.name : "aucune bibliothèque musique"})`);
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : String(error);
      console.warn(`[music] passage complet de l'index interrompu : ${state.lastError}`);
    } finally {
      state.running = false;
      running = null;
    }
    return changes;
  })();
  return running;
}

async function allIndexedIds(): Promise<string[]> {
  const kinds = await Promise.all([orderedIds("track", "name"), orderedIds("album", "name"), orderedIds("artist", "name")]);
  return kinds.flat();
}

function under(library: MusicLibrary, path: string | undefined): boolean {
  if (!path) return false;
  return library.paths.some((root) => {
    const r = root.replace(/[\\/]+$/, "");
    return path === r || path.startsWith(`${r}/`) || path.startsWith(`${r}\\`);
  });
}

async function fetchByIds(ids: string[]): Promise<JfItem[]> {
  const user = await adminUserParam();
  const out: JfItem[] = [];
  for (let i = 0; i < ids.length; i += IDS_BATCH) {
    const batch = ids.slice(i, i + IDS_BATCH);
    const result = await jfAdmin<JfItemsPage>(`/Items?Ids=${batch.map(q).join(",")}&Fields=${INDEX_FIELDS}&EnableImages=true&ImageTypeLimit=1&EnableUserData=false${user}`);
    if (result.ok) out.push(...(result.data.Items ?? []));
  }
  return out;
}

export interface IncrementalResult {
  added: IndexRow[];
  updated: IndexRow[];
  removed: string[];
  addedRefs: AudioItemRef[];
  updatedRefs: AudioItemRef[];
  /** Playlists touchées que la clé voit (publiques). */
  playlists: string[];
  /**
   * Touchés, mais ni dans l'index ni visibles à la clé : une playlist PRIVÉE
   * d'un compte (l'administrateur ne la voit pas), ou un dossier.
   */
  unresolved: string[];
}

/** Un `LibraryChanged` : ses ajouts, mises à jour et retraits, appliqués à l'index. */
export async function applyLibraryChange(addedIds: string[], updatedIds: string[], removedIds: string[]): Promise<IncrementalResult | null> {
  const library = await getMusicLibrary();
  if (!library) return null;
  const removedRows = await rowsByIds(removedIds.map(normalizeId));
  // Jellyfin ne dit que le dossier retiré (l'album) : ses titres partent avec lui (relevé du banc).
  for (const row of [...removedRows.values()]) {
    if (row.kind === "album") for (const track of await albumTracks(row.id)) removedRows.set(track.id, track);
  }
  const removed = await removeRows([...removedRows.keys()]);
  const removedTracks = removed.filter((id) => removedRows.get(id)?.kind === "track");
  const touched = [...new Set([...addedIds, ...updatedIds].map(normalizeId))];
  const items = await fetchByIds(touched);
  const playlists = items.filter((i) => i.Type === "Playlist").map((i) => normalizeId(i.Id));
  const inLibrary = items.filter((i) => (i.Type === "Audio" || i.Type === "MusicAlbum") && under(library, i.Path));
  // Les artistes crédités que l'index ne connaît pas encore entrent avec eux.
  const credited = [...new Set(inLibrary.flatMap((i) => [...(i.ArtistItems ?? []), ...(i.AlbumArtists ?? [])]).map((a) => a.Id).filter((id): id is string => !!id).map(normalizeId))];
  const knownBefore = await rowsByIds([...inLibrary.map((i) => normalizeId(i.Id)), ...credited]);
  const newArtists = await fetchByIds(credited.filter((id) => !knownBefore.has(id)));
  const rows = [...inLibrary, ...newArtists].map(rowFromItem).filter((r): r is IndexRow => r !== null);
  await upsertRows(rows, await currentGeneration());
  if (newArtists.length > 0) await fillArtistMbids();
  const isNew = (row: IndexRow) => !knownBefore.has(row.id);
  const tracks = inLibrary.filter((i) => i.Type === "Audio");
  const result: IncrementalResult = {
    added: rows.filter(isNew),
    updated: rows.filter((r) => !isNew(r)),
    removed,
    addedRefs: tracks.filter((i) => !knownBefore.has(normalizeId(i.Id))).map(audioRef),
    updatedRefs: tracks.filter((i) => knownBefore.has(normalizeId(i.Id))).map(audioRef),
    playlists,
    unresolved: touched.filter((id) => !items.some((i) => normalizeId(i.Id) === id) && !knownBefore.has(id)),
  };
  if (result.added.length > 0 || result.removed.length > 0) invalidateMusicVisibility();
  publishAudioItems({ added: result.addedRefs, updated: result.updatedRefs, removed: removedTracks });
  return result;
}

export function resetIndexSyncForTests(): void {
  Object.assign(state, { ready: false, running: false, lastFullAt: null, lastError: null });
  running = null;
}
