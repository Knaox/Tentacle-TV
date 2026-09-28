import { readGlobalCache, writeGlobalCache } from "../globalCacheStore";
import { sortSagaParts, type SagaInfo, type SagaPart } from "../../saga/sagaTypes";
import { tmdbConfigured, tmdbFetch } from "./client";
import type { TmdbPriority } from "./client";

/**
 * Une saga TMDB (`GET /collection/{id}`) : son nom dans la langue de
 * l'interface et ses volets, dans l'ordre de sortie.
 *
 * Même régime que les notes d'épisodes (`seasonEpisodes.ts`) : mémoire →
 * disque (une copie périmée est servie si TMDB ne répond pas) → TMDB, un seul
 * appel en vol par saga et par langue. Jamais d'exception : null quand rien
 * n'est connu, et la rangée garde alors un titre générique.
 */

export type SagaLang = "fr" | "en";

interface CachedSaga {
  saga: SagaInfo;
  /** ISO — la fraîcheur se juge sur le payload, jamais sur la ligne. */
  fetchedAt: string;
}

/** Une journée : un volet s'annonce, une date de sortie tombe. */
const FRESH_MS = 24 * 3600_000;
const DISK_TTL_MS = 30 * 24 * 3600_000;
const MEMORY_MAX = 300;
/** Une saga que TMDB ne connaît pas n'est pas redemandée avant six heures. */
const MISSING_MS = 6 * 3600_000;

const memory = new Map<string, CachedSaga>();
const missing = new Map<string, number>();
const inFlight = new Map<string, Promise<SagaInfo | null>>();

/** Clé de la ligne globale — tient dans le VarChar(64) de recommendation_cache. */
function keyOf(collectionId: number, lang: SagaLang): string {
  return `tmdbSaga:${collectionId}:${lang}`;
}

function isFresh(entry: CachedSaga, now = Date.now()): boolean {
  const at = Date.parse(entry.fetchedAt);
  return Number.isFinite(at) && now - at < FRESH_MS;
}

/**
 * Normalise la réponse brute de `/collection/{id}` — tolérante et pure : un
 * volet sans identifiant entier ou sans titre est ignoré, un doublon aussi,
 * une date illisible vaut « annoncé » ; les volets sortent triés.
 */
export function normalizeSagaCollection(raw: unknown, collectionId: number): SagaInfo | null {
  const body = raw as { name?: unknown; parts?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name === "" || !Array.isArray(body?.parts)) return null;
  const parts: SagaPart[] = [];
  const seen = new Set<number>();
  for (const entry of body.parts) {
    const part = entry as { id?: unknown; title?: unknown; release_date?: unknown } | null;
    const tmdbId = Number(part?.id);
    const title = typeof part?.title === "string" ? part.title.trim() : "";
    if (!Number.isInteger(tmdbId) || tmdbId <= 0 || title === "" || seen.has(tmdbId)) continue;
    seen.add(tmdbId);
    const date = part?.release_date;
    parts.push({ tmdbId, title, releaseDate: typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null });
  }
  return { collectionId, name, parts: sortSagaParts(parts) };
}

/** Une ligne du disque d'une autre forme (version antérieure, JSON tronqué) ne sert pas. */
function readable(entry: CachedSaga | null | undefined): CachedSaga | null {
  return entry && typeof entry.saga?.name === "string" && Array.isArray(entry.saga.parts) ? entry : null;
}

/** Mémoire bornée, la plus ancienne clé sort la première. */
function remember(key: string, entry: CachedSaga): SagaInfo {
  memory.delete(key);
  memory.set(key, entry);
  if (memory.size > MEMORY_MAX) {
    const oldest = memory.keys().next().value;
    if (oldest !== undefined) memory.delete(oldest);
  }
  return entry.saga;
}

async function fetchSaga(collectionId: number, lang: SagaLang, priority: TmdbPriority): Promise<CachedSaga | null> {
  const key = keyOf(collectionId, lang);
  try {
    const raw = await tmdbFetch<unknown>(`/collection/${collectionId}`, { language: lang === "fr" ? "fr-FR" : "en-US" }, { priority });
    const saga = normalizeSagaCollection(raw, collectionId);
    if (saga === null) return null;
    const entry: CachedSaga = { saga, fetchedAt: new Date().toISOString() };
    await writeGlobalCache(key, entry, DISK_TTL_MS).catch(() => undefined);
    return entry;
  } catch (err) {
    if ((err as { status?: number }).status === 404) missing.set(key, Date.now());
    return null;
  }
}

export async function getSagaCollection(
  collectionId: number,
  lang: SagaLang,
  opts: { priority?: TmdbPriority } = {},
): Promise<SagaInfo | null> {
  const key = keyOf(collectionId, lang);
  const hot = memory.get(key);
  if (hot && isFresh(hot)) return hot.saga;
  const lost = missing.get(key);
  if (lost !== undefined && Date.now() - lost < MISSING_MS) return hot?.saga ?? null;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const task = (async () => {
    const disk = hot ?? readable((await readGlobalCache<CachedSaga>(key).catch(() => null))?.payload);
    if (disk && isFresh(disk)) return remember(key, disk);
    if (!tmdbConfigured()) return disk ? remember(key, disk) : null;
    const fresh = await fetchSaga(collectionId, lang, opts.priority ?? "interactive");
    if (fresh) return remember(key, fresh);
    return disk ? remember(key, disk) : null;
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, task);
  return task;
}

export function resetSagaCollectionsForTests(): void {
  memory.clear();
  missing.clear();
  inFlight.clear();
}
