/**
 * Octave — les pages gardées, reliées au cache de requêtes :
 * - `hydrateOctaveCache` : au montage, les pages du COMPTE (jamais celles d'un
 *   autre, effacées) reviennent dans le cache avec leur vraie date — affichées
 *   aussitôt, revalidées en silence quand elles sont périmées pour leur crochet ;
 *   une donnée déjà en mémoire n'est jamais écrasée ;
 * - `attachOctaveCache` : chaque page FINIE reçue est écrite (par lots, au
 *   repos), chaque page rouverte remonte dans l'ordre d'éviction.
 * Le compte est figé à l'attache (modèle de `queryPersister`) : il désigne
 * celui dont les données sont en mémoire.
 */

import { evictionPlan, persistable, persistKindOf, type StoredEntry } from "./octaveCachePolicy";
import type { OctaveCacheBackend } from "./octaveCacheStore";

interface QueryLike {
  queryKey: unknown;
  state: { status: string; data: unknown; dataUpdatedAt: number };
}
interface CacheEventLike {
  type: string;
  action?: { type?: string };
  query?: QueryLike;
}
export interface OctaveQueryClientLike {
  setQueryData(queryKey: unknown, data: unknown, options?: { updatedAt?: number }): unknown;
  getQueryData(queryKey: unknown): unknown;
  getQueryCache(): { subscribe(listener: (event: CacheEventLike) => void): () => void };
}

export type Meta = Omit<StoredEntry, "data">;

/** Ce qu'une hydratation a rendu (mesure et préchauffage des pochettes). */
export interface HydrationResult {
  restored: number;
  dropped: number;
  /** Les données rendues, de la plus récemment utilisée à la plus ancienne. */
  recent: unknown[];
  /** Ce qui reste sur le disque (pour l'éviction de l'attache). */
  known: Meta[];
}

const sizeCache = new WeakMap<object, number>();
function bytesOf(data: unknown): number {
  if (data === null || typeof data !== "object") return 16;
  const known = sizeCache.get(data);
  if (known !== undefined) return known;
  let size: number;
  try {
    size = JSON.stringify(data).length;
  } catch {
    size = Number.POSITIVE_INFINITY;
  }
  sizeCache.set(data, size);
  return size;
}

export async function hydrateOctaveCache(qc: OctaveQueryClientLike, backend: OctaveCacheBackend, owner: string, now = Date.now()): Promise<HydrationResult> {
  const all = await backend.loadAll();
  const drop = new Set(evictionPlan(all, owner, now));
  if (drop.size > 0) void backend.remove([...drop]);
  const kept = all.filter((e) => !drop.has(e.id)).sort((a, b) => b.usedAt - a.usedAt);
  let restored = 0;
  for (const entry of kept) {
    try {
      const key = JSON.parse(entry.id) as unknown[];
      if (qc.getQueryData(key) !== undefined) continue;
      qc.setQueryData(key, entry.data, { updatedAt: entry.savedAt });
      restored++;
    } catch {
      /* Une entrée illisible ne retient pas les autres. */
    }
  }
  const known = kept.map(({ data: _data, ...meta }) => meta);
  return { restored, dropped: drop.size, recent: kept.map((e) => e.data), known };
}

export interface AttachOptions {
  now?: () => number;
  /** Délai d'un lot d'écritures (ms) : les pages d'une même recherche partent ensemble. */
  flushDelayMs?: number;
  /** Les entrées déjà sur le disque (fin de l'hydratation), pour l'éviction. */
  known?: readonly Meta[];
}

export function attachOctaveCache(qc: OctaveQueryClientLike, backend: OctaveCacheBackend, owner: string, options: AttachOptions = {}): () => void {
  const now = options.now ?? Date.now;
  const delay = options.flushDelayMs ?? 1_000;
  const index = new Map<string, Meta>((options.known ?? []).map((m) => [m.id, m]));
  const pending = new Map<string, StoredEntry>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    const batch = [...pending.values()];
    pending.clear();
    for (const { data: _data, ...meta } of batch) index.set(meta.id, meta);
    const drop = evictionPlan([...index.values()].map((m) => ({ ...m, data: null })), owner, now());
    for (const id of drop) index.delete(id);
    const dropped = new Set(drop);
    void backend.put(batch.filter((e) => !dropped.has(e.id))).then(() => backend.remove(drop));
  };
  const schedule = () => {
    if (timer === null) timer = setTimeout(flush, delay);
  };

  const remember = (query: QueryLike, touchOnly: boolean) => {
    const kind = persistKindOf(query.queryKey);
    const { status, data, dataUpdatedAt } = query.state;
    if (!kind || status !== "success" || !persistable(kind, data)) return;
    let id: string;
    try {
      id = JSON.stringify(query.queryKey);
    } catch {
      return;
    }
    // Une page rouverte sans changement est réécrite telle quelle : sa place dans l'éviction remonte.
    if (touchOnly && pending.has(id)) return;
    const bytes = bytesOf(data);
    if (!Number.isFinite(bytes)) return;
    pending.set(id, { id, owner, kind, data, savedAt: dataUpdatedAt, usedAt: now(), bytes });
    schedule();
  };

  const unsubscribe = qc.getQueryCache().subscribe((event) => {
    if (!event.query) return;
    if (event.type === "updated" && event.action?.type === "success") remember(event.query, false);
    else if (event.type === "observerAdded") remember(event.query, true);
  });
  return () => {
    unsubscribe();
    if (timer !== null) {
      clearTimeout(timer);
      flush();
    }
  };
}
