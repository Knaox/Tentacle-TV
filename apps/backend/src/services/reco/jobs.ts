import { getPrisma } from "../db";
import { runCooccurrenceJob } from "./cooccurrence";
import { loadIdfFromDb, recomputeIdf } from "./idfStore";
import { rebuildProfile } from "./profileBuilder";
import { startSyncWorkers, stopSyncWorkers } from "./syncWorkers";

// Même doctrine que les autres workers : setInterval dans le process Fastify,
// un couple start/stop, timers mémorisés au module. Pas de cron, pas de file.

const IDF_INTERVAL_MS = 24 * 3600_000;
const IDF_BOOT_DELAY_MS = 30_000;
const POKE_DEBOUNCE_MS = 8_000;
const COOCCURRENCE_INTERVAL_MS = 6 * 3600_000;
const COOCCURRENCE_BOOT_DELAY_MS = 2 * 60_000;
const CACHE_PURGE_INTERVAL_MS = 3600_000;

let idfTimer: NodeJS.Timeout | null = null;
let idfBootTimer: NodeJS.Timeout | null = null;
let coocTimer: NodeJS.Timeout | null = null;
let coocBootTimer: NodeJS.Timeout | null = null;
let purgeTimer: NodeJS.Timeout | null = null;
const profileTimers = new Map<string, NodeJS.Timeout>();

async function runIdf(): Promise<void> {
  try {
    const { facets, docs } = await recomputeIdf();
    console.log(`[Reco] IDF recalculé : ${facets} facettes sur ${docs} titres`);
  } catch (err) {
    console.error("[Reco] Échec du recalcul IDF :", err);
  }
}

export function startRecoJobs(): void {
  if (idfTimer) return;

  // Au démarrage : charge les IDF existants ; table vide (première fois) →
  // premier comptage 30 s plus tard, le temps que le serveur se pose.
  idfBootTimer = setTimeout(async () => {
    idfBootTimer = null;
    try {
      const loaded = await loadIdfFromDb();
      if (loaded === 0) await runIdf();
    } catch (err) {
      console.error("[Reco] Chargement IDF impossible :", err);
    }
  }, IDF_BOOT_DELAY_MS);

  idfTimer = setInterval(() => void runIdf(), IDF_INTERVAL_MS);

  // Cooccurrence communautaire : premier passage 2 min après le démarrage
  // (laisser la base et Jellyfin se poser), puis toutes les 6 h.
  coocBootTimer = setTimeout(() => {
    coocBootTimer = null;
    void runCooccurrence();
  }, COOCCURRENCE_BOOT_DELAY_MS);
  coocTimer = setInterval(() => void runCooccurrence(), COOCCURRENCE_INTERVAL_MS);

  purgeTimer = setInterval(() => {
    void purgeExpiredRecoCache().catch(() => undefined);
  }, CACHE_PURGE_INTERVAL_MS);

  // Poussée des notes vers TMDB/AniList (tick 15 s, backoff par ligne).
  startSyncWorkers();
}

async function runCooccurrence(): Promise<void> {
  try {
    const stats = await runCooccurrenceJob();
    console.log(
      `[Reco] Cooccurrences : ${stats.pairsKept} paires (${stats.users} comptes, ` +
        `${stats.optedOut} désinscrits, ${stats.titles} titres)`
    );
  } catch (err) {
    console.error("[Reco] Échec du job de cooccurrence :", err);
  }
}

export function stopRecoJobs(): void {
  stopSyncWorkers();
  if (idfTimer) { clearInterval(idfTimer); idfTimer = null; }
  if (idfBootTimer) { clearTimeout(idfBootTimer); idfBootTimer = null; }
  if (coocTimer) { clearInterval(coocTimer); coocTimer = null; }
  if (coocBootTimer) { clearTimeout(coocBootTimer); coocBootTimer = null; }
  if (purgeTimer) { clearInterval(purgeTimer); purgeTimer = null; }
  for (const t of profileTimers.values()) clearTimeout(t);
  profileTimers.clear();
}

/**
 * Demande une reconstruction du profil de goût, débouncée par compte (8 s) :
 * une salve de notes ou d'événements UserData ne coûte qu'un rebuild. Appelée
 * par les routes de notation/likes et par le WS Jellyfin (UserDataChanged).
 */
export function pokeProfile(userId: string | undefined | null): void {
  if (!userId) return;
  const existing = profileTimers.get(userId);
  if (existing) clearTimeout(existing);
  profileTimers.set(
    userId,
    setTimeout(() => {
      profileTimers.delete(userId);
      rebuildProfile(userId).catch((err) =>
        console.error(`[Reco] Rebuild du profil ${userId.slice(0, 8)}… en échec :`, err)
      );
    }, POKE_DEBOUNCE_MS)
  );
}

/** Purge périodique du cache de rangées expiré (partagée avec la Phase 5). */
export async function purgeExpiredRecoCache(): Promise<number> {
  const prisma = getPrisma();
  const res = await prisma.recommendationCache.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return res.count;
}
