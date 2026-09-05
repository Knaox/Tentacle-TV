import { getPrisma } from "../db";
import { enqueueFromPool, isCrawlerRunning, maybeFlush, crawlerStatus } from "./metaCrawler";
import { POOL_ROW_KEY, readPool } from "./poolStore";

/** Après IDF (30 s) et tendances (45 s) : le serveur est posé. */
export const CRAWL_RESEED_BOOT_DELAY_MS = 90_000;
const RESEED_PAUSE_MS = 250;

let reseeding = false;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Reconstitue la file du crawler depuis TOUS les pools — au démarrage (la
 * file vit en mémoire) et quand la région change (les plateformes des pools
 * sont celles de l'ancienne région). Un pool à la fois : jamais tous les
 * payloads en mémoire d'un coup. Le cache est lu d'abord, sans réseau.
 */
export function requestCrawlerReseed(reason: "boot" | "region"): void {
  if (reseeding) return;
  reseeding = true;
  void (async () => {
    try {
      const prisma = getPrisma();
      const accounts = await prisma.recommendationCache.findMany({
        where: { rowKey: POOL_ROW_KEY },
        select: { jellyfinUserId: true },
      });
      let pools = 0;
      for (const { jellyfinUserId } of accounts) {
        if (!isCrawlerRunning()) break;
        const pool = await readPool(jellyfinUserId);
        if (pool) {
          await enqueueFromPool(jellyfinUserId, pool, { cachePass: true });
          pools++;
        }
        await sleep(RESEED_PAUSE_MS);
      }
      await maybeFlush(true);
      console.log(`[Reco] Crawler : reseed (${reason}) sur ${pools} pools, file ${crawlerStatus().queued}`);
    } catch (err) {
      console.error("[Reco] Crawler : reseed en échec :", err);
    } finally {
      reseeding = false;
    }
  })();
}
