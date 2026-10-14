/* ------------------------------------------------------------------ */
/*  Chercher sur la chaîne Dailymotion d'AlloCiné — une fois par titre  */
/*                                                                     */
/*  `api.dailymotion.com/user/allocine/videos?search=…` répond sans    */
/*  clé, 100 vidéos par page. On lit deux pages au plus, et l'on ne    */
/*  garde que les bandes-annonces et teasers au format d'AlloCiné      */
/*  (quelques Ko) dans la mémoire GLOBALE du serveur                   */
/*  (`globalCacheStore`, clé `trailers:allocine:<titre normalisé>`) : */
/*  tous les comptes la partagent, et une recherche sert TOUTES les    */
/*  saisons d'une série. Elle vaut 7 jours, 2 pour une série en cours, */
/*  1 si elle n'a rien trouvé ; échue, elle sert encore pendant qu'une */
/*  nouvelle recherche part en fond. Chaque appel passe par le garde   */
/*  de Dailymotion (`dailymotionGuard.ts`).                            */
/* ------------------------------------------------------------------ */

import { readGlobalCache, writeGlobalCache } from "../../globalCacheStore";
import { recordDailymotionResponse, takeDailymotionSlot, type DailymotionPriority } from "../dailymotionGuard";
import { normalizeShowName, type AllocineVideo } from "./allocineMatch";
import { parseAllocineTitle } from "./allocineTitle";

const API = "https://api.dailymotion.com/user/allocine/videos";
const FIELDS = "id,title,created_time,duration";
const PAGE_SIZE = 100;
const MAX_PAGES = 2;
const REQUEST_TIMEOUT_MS = 5_000;
/** Une attente plus longue que ça, c'est le fond qui finira la recherche. */
const MAX_WAIT_MS = 2_000;
const DAY_MS = 86_400_000;
/** La ligne reste en base un peu au-delà de sa validité : échue, elle sert encore. */
const KEEP_ROW_MS = 30 * DAY_MS;

export interface AllocineSearch {
  videos: AllocineVideo[];
  /** Quand la recherche a été faite (ms). */
  fetchedAt: number;
  /** Au-delà, la refaire (la garder en attendant). */
  validUntil: number;
}

export interface SearchOptions {
  /** Une série encore diffusée : ses nouvelles saisons arrivent, la recherche vaut 2 jours. */
  ongoing?: boolean;
  priority?: DailymotionPriority;
}

interface ApiPage {
  list?: Array<{ id?: unknown; title?: unknown; created_time?: unknown; duration?: unknown }>;
  has_more?: boolean;
}

const inflight = new Map<string, Promise<AllocineSearch | null>>();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const allocineCacheKey = (query: string) => `trailers:allocine:${normalizeShowName(query)}`;

function videosOf(page: ApiPage): AllocineVideo[] {
  const videos: AllocineVideo[] = [];
  for (const raw of page.list ?? []) {
    if (typeof raw.id !== "string" || typeof raw.title !== "string") continue;
    if (typeof raw.created_time !== "number" || typeof raw.duration !== "number") continue;
    // Seules les bandes-annonces et les teasers d'AlloCiné entrent en mémoire.
    if (!parseAllocineTitle(raw.title)) continue;
    videos.push({ id: raw.id, title: raw.title, createdTime: raw.created_time, duration: raw.duration });
  }
  return videos;
}

/** Une place chez Dailymotion : accordée, ou attendue un peu (un appel attendu), ou rien. */
async function slot(priority: DailymotionPriority): Promise<boolean> {
  let wait = takeDailymotionSlot("api", priority);
  if (wait > 0 && wait <= MAX_WAIT_MS && priority === "interactive") {
    await sleep(wait);
    wait = takeDailymotionSlot("api", priority);
  }
  return wait === 0;
}

async function readPage(query: string, page: number): Promise<ApiPage | null> {
  const url = `${API}?search=${encodeURIComponent(query)}&fields=${FIELDS}&limit=${PAGE_SIZE}&page=${page}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    recordDailymotionResponse(res.status);
    return res.ok ? ((await res.json()) as ApiPage) : null;
  } catch {
    return null;
  }
}

/** La recherche, sur le réseau ; `null` : Dailymotion n'a pas répondu, ou le garde a refusé. */
async function search(query: string, options: SearchOptions): Promise<AllocineSearch | null> {
  const priority = options.priority ?? "interactive";
  const videos: AllocineVideo[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    if (!(await slot(priority))) return page === 1 ? null : finish(query, videos, options);
    const result = await readPage(query, page);
    if (!result) return page === 1 ? null : finish(query, videos, options);
    videos.push(...videosOf(result));
    if (!result.has_more) break;
  }
  return finish(query, videos, options);
}

async function finish(query: string, videos: AllocineVideo[], options: SearchOptions): Promise<AllocineSearch> {
  const now = Date.now();
  const days = videos.length === 0 ? 1 : options.ongoing ? 2 : 7;
  const result: AllocineSearch = { videos, fetchedAt: now, validUntil: now + days * DAY_MS };
  await writeGlobalCache(allocineCacheKey(query), result, KEEP_ROW_MS).catch(() => undefined);
  return result;
}

function shared(query: string, options: SearchOptions): Promise<AllocineSearch | null> {
  const key = allocineCacheKey(query);
  const pending = inflight.get(key);
  if (pending) return pending;
  const task = search(query, options).finally(() => inflight.delete(key));
  inflight.set(key, task);
  return task;
}

function isSearch(value: unknown): value is AllocineSearch {
  const search = value as Partial<AllocineSearch> | null;
  return !!search && Array.isArray(search.videos) && typeof search.validUntil === "number" && typeof search.fetchedAt === "number";
}

/**
 * Les bandes-annonces AlloCiné que la recherche `query` (le nom français du
 * titre) trouve : la mémoire si elle vaut, sinon le réseau. Une mémoire échue
 * sert tout de suite et se refait en fond. `null` : rien à dire pour l'instant
 * (Dailymotion muet ou en pause) — ce n'est pas « aucune ».
 */
export async function searchAllocineVideos(query: string, options: SearchOptions = {}): Promise<AllocineSearch | null> {
  if (!normalizeShowName(query)) return null;
  const cached = await readGlobalCache<unknown>(allocineCacheKey(query)).catch(() => null);
  if (cached && isSearch(cached.payload)) {
    if (cached.payload.validUntil > Date.now()) return cached.payload;
    void shared(query, { ...options, priority: "background" }).catch(() => undefined);
    return cached.payload;
  }
  return shared(query, options);
}

/** Pour les tests. */
export function resetAllocineSearches(): void {
  inflight.clear();
}
