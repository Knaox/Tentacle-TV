import { tmdbConfigured, tmdbLastInteractiveAt } from "../tmdb/client";
import { getCachedMetaMany, getTitleMeta, metaKey } from "../tmdb/metaCache";
import { watchRegion } from "../tmdb/providerNormalize";
import { CrawlQueue, crawlKey } from "./crawlQueue";
import type { PoolPayload } from "./generationJob";
import { entriesNeedingProviders, providerIdsOf } from "./poolProviders";
import type { CrawlTarget } from "./poolProviders";
import { patchPool } from "./poolStore";

/**
 * Le crawler de plateformes : en FOND, il demande à TMDB la fiche des titres
 * dont la disponibilité est inconnue — d'abord ceux des pools (les mieux
 * classés en tête, un compte après l'autre), puis les rangées servies — et
 * pose ce qu'il apprend dans les pools. C'est lui qui rend le filtre strict
 * COMPLET : sans lui, un pool de mille entrées n'en connaît que deux cents.
 *
 * Doctrine des workers maison (syncWorkers) : une chaîne de setTimeout dans
 * le process Fastify, jamais deux itérations en même temps, une erreur ne
 * l'arrête jamais. Il s'efface deux secondes après tout appel interactif et
 * respecte un budget quotidien d'appels.
 */
const CRAWL_TICK_MS = 400;
const CRAWL_IDLE_MS = 5_000;
const CRAWL_UNCONFIGURED_MS = 30_000;
const CRAWL_BUDGET_EXHAUSTED_MS = 15 * 60_000;
const CRAWL_INTERACTIVE_PAUSE_MS = 2_000;
const CRAWL_FLUSH_EVERY = 50;
const CRAWL_FLUSH_IDLE_MS = 60_000;
export const SERVED_BUCKET = "served";

let dailyBudget = Number(process.env.RECO_CRAWL_DAILY_BUDGET) || 4000;

export interface CrawlerHooks {
  /** Un pool vient de recevoir des plateformes : sa page est à reconstruire. */
  onPoolPatched?: (userId: string) => void;
}

const queue = new CrawlQueue();
/** clé → ids appris, en attente d'un flush vers les pools. */
const learned = new Map<string, number[]>();
/** compte → clés que son pool attend encore. */
const awaiting = new Map<string, Set<string>>();
let hooks: CrawlerHooks = {};
let timer: NodeJS.Timeout | null = null;
let running = false;
let paused = false;
let usedToday = 0;
let budgetDay = "";
let learnedTotal = 0;
let lastLearnedAt = 0;

function dayStamp(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function startMetaCrawler(h: CrawlerHooks = {}): void {
  hooks = h;
  if (running) return;
  running = true;
  schedule(CRAWL_TICK_MS);
}

export function stopMetaCrawler(): void {
  running = false;
  if (timer) clearTimeout(timer);
  timer = null;
}

export function isCrawlerRunning(): boolean {
  return running;
}

function schedule(ms: number): void {
  if (!running) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void tick();
  }, ms);
}

async function tick(): Promise<void> {
  let delay = CRAWL_TICK_MS;
  try {
    delay = await step();
  } catch (err) {
    console.error("[Reco] Crawler :", err);
    delay = CRAWL_IDLE_MS;
  } finally {
    schedule(delay);
  }
}

/** Une itération ; rend le délai avant la suivante. */
async function step(): Promise<number> {
  if (!tmdbConfigured()) return CRAWL_UNCONFIGURED_MS;
  const today = dayStamp();
  if (today !== budgetDay) {
    budgetDay = today;
    usedToday = 0;
  }
  if (usedToday >= dailyBudget) {
    await maybeFlush(true);
    return CRAWL_BUDGET_EXHAUSTED_MS;
  }
  if (Date.now() - tmdbLastInteractiveAt() < CRAWL_INTERACTIVE_PAUSE_MS) {
    paused = true;
    return 500;
  }
  paused = false;
  const next = queue.next();
  if (!next) {
    await maybeFlush(false);
    return CRAWL_IDLE_MS;
  }
  usedToday++;
  const key = crawlKey(next.target);
  const meta = await getTitleMeta(next.target.mediaType, next.target.tmdbId, { priority: "background" });
  const ids = providerIdsOf(meta);
  if (ids) {
    learned.set(key, ids);
    learnedTotal++;
    lastLearnedAt = Date.now();
  } else {
    queue.markFailed(key);
  }
  if (learned.size >= CRAWL_FLUSH_EVERY) await flushLearned();
  return CRAWL_TICK_MS;
}

/** Flush si assez de temps a passé depuis le dernier apprentissage (ou forcé). */
export async function maybeFlush(force: boolean): Promise<void> {
  if (learned.size === 0) return;
  if (force || Date.now() - lastLearnedAt >= CRAWL_FLUSH_IDLE_MS) await flushLearned();
}

/** Enfile des identités (rangées globales, items servis) dans un seau. */
export function enqueueCrawl(targets: Iterable<CrawlTarget>, bucket = SERVED_BUCKET): number {
  return queue.enqueue(bucket, targets);
}

/**
 * Enfile ce que le pool d'un compte ignore. `cachePass` (reseed) : le cache
 * d'abord — le payload brut porte toutes les régions. Un pool d'une AUTRE
 * région est réappris tout de suite depuis le cache, le reste part en file.
 */
export async function enqueueFromPool(
  userId: string,
  pool: PoolPayload,
  opts: { cachePass?: boolean } = {}
): Promise<void> {
  const region = watchRegion();
  const foreignRegion = pool.providersRegion !== undefined && pool.providersRegion !== region;
  let targets: CrawlTarget[];
  if (foreignRegion) {
    const refs = pool.entries.map((e) => ({ mediaType: e.candidate.mediaType, tmdbId: e.candidate.tmdbId }));
    const metas = await getCachedMetaMany(refs);
    const res = await patchPool(userId, (stored) => {
      stored.providersRegion = region;
      for (const entry of stored.entries) {
        entry.providers = providerIdsOf(metas.get(entry.candidate.key));
      }
      return true;
    });
    if (res === "patched") hooks.onPoolPatched?.(userId);
    targets = refs.filter((r) => providerIdsOf(metas.get(metaKey(r.mediaType, r.tmdbId))) === null);
  } else {
    targets = entriesNeedingProviders(pool.entries);
    if (opts.cachePass && targets.length > 0) {
      const metas = await getCachedMetaMany(targets);
      const remaining: CrawlTarget[] = [];
      for (const target of targets) {
        const key = crawlKey(target);
        const ids = providerIdsOf(metas.get(key));
        if (ids) learned.set(key, ids);
        else remaining.push(target);
      }
      targets = remaining;
    }
  }
  if (targets.length === 0 && learned.size === 0) return;
  const keys = awaiting.get(userId) ?? new Set<string>();
  for (const target of targets) keys.add(crawlKey(target));
  for (const key of learned.keys()) keys.add(key);
  awaiting.set(userId, keys);
  queue.enqueue(userId, targets);
  if (learned.size >= CRAWL_FLUSH_EVERY) await flushLearned();
}

/**
 * Pose les plateformes apprises dans les pools qui les attendent, puis
 * prévient (page à reconstruire). Un pool régénéré entre-temps (« raced »)
 * ou disparu n'est jamais une erreur : la nouvelle génération se ré-enfile.
 */
export async function flushLearned(): Promise<{ pools: number; patched: number }> {
  if (learned.size === 0) return { pools: 0, patched: 0 };
  const batch = new Map(learned);
  learned.clear();
  let pools = 0;
  let patched = 0;
  for (const [userId, keys] of awaiting) {
    let concerned = false;
    for (const key of keys) {
      if (batch.has(key)) {
        concerned = true;
        break;
      }
    }
    if (!concerned) continue;
    pools++;
    const res = await patchPool(userId, (pool) => {
      let changed = false;
      for (const entry of pool.entries) {
        const ids = batch.get(entry.candidate.key);
        if (ids && entry.providers == null) {
          entry.providers = ids;
          changed = true;
        }
      }
      return changed;
    });
    for (const key of batch.keys()) keys.delete(key);
    if (keys.size === 0 || res === "missing" || res === "raced") awaiting.delete(userId);
    if (res === "patched") {
      patched++;
      hooks.onPoolPatched?.(userId);
    }
  }
  console.log(
    `[Reco] Crawler : ${batch.size} titres appris, ${patched}/${pools} pools patchés, file ${queue.size}, budget ${usedToday}/${dailyBudget}`
  );
  return { pools, patched };
}

export function crawlerStatus(): {
  queued: number;
  learned: number;
  usedToday: number;
  budget: number;
  paused: boolean;
} {
  return { queued: queue.size, learned: learnedTotal, usedToday, budget: dailyBudget, paused };
}

/** Isolation des tests : état vidé, budget ajustable. */
export function resetMetaCrawlerForTests(opts: { dailyBudget?: number } = {}): void {
  stopMetaCrawler();
  hooks = {};
  learned.clear();
  awaiting.clear();
  paused = false;
  usedToday = 0;
  budgetDay = "";
  learnedTotal = 0;
  lastLearnedAt = 0;
  dailyBudget = opts.dailyBudget ?? (Number(process.env.RECO_CRAWL_DAILY_BUDGET) || 4000);
  while (queue.next()) {
    // vide la file
  }
}
