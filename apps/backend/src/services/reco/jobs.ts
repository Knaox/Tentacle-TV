import { getPrisma } from "../db";
import { runCooccurrenceJob } from "./cooccurrence";
import { generatePool, readPool } from "./generationJob";
import { loadIdfFromDb, recomputeIdf } from "./idfStore";
import { rebuildProfile } from "./profileBuilder";
import { runServerPulseJob } from "./serverPulse";
import { startSyncWorkers, stopSyncWorkers } from "./syncWorkers";
import { refreshTrending } from "./trendingRow";

// Même doctrine que les autres workers : setInterval dans le process Fastify,
// un couple start/stop, timers mémorisés au module. Pas de cron, pas de file.

const IDF_INTERVAL_MS = 24 * 3600_000;
const IDF_BOOT_DELAY_MS = 30_000;
const POKE_DEBOUNCE_MS = 8_000;
const COOCCURRENCE_INTERVAL_MS = 6 * 3600_000;
const COOCCURRENCE_BOOT_DELAY_MS = 2 * 60_000;
const CACHE_PURGE_INTERVAL_MS = 3600_000;
const TRENDING_INTERVAL_MS = 12 * 3600_000;
const TRENDING_BOOT_DELAY_MS = 45_000;
/** Garde d'âge de la régénération après rebuild : c'est LE réglage de coût
 *  API (~110 appels TMDB par génération complète) — borne à ~2 générations
 *  par heure et par compte actif. Un favori ajouté devient graine sous 30 min. */
const POOL_REGEN_MIN_AGE_MS = 30 * 60_000;

let idfTimer: NodeJS.Timeout | null = null;
let idfBootTimer: NodeJS.Timeout | null = null;
let coocTimer: NodeJS.Timeout | null = null;
let coocBootTimer: NodeJS.Timeout | null = null;
let purgeTimer: NodeJS.Timeout | null = null;
let trendingTimer: NodeJS.Timeout | null = null;
let trendingBootTimer: NodeJS.Timeout | null = null;
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

  // Cooccurrence communautaire + pouls serveur : premier passage 2 min après
  // le démarrage (laisser la base et Jellyfin se poser), puis toutes les 6 h.
  // Le pouls vit au rythme de la cooccurrence — il lit les mêmes tables.
  coocBootTimer = setTimeout(() => {
    coocBootTimer = null;
    void runCommunityJobs();
  }, COOCCURRENCE_BOOT_DELAY_MS);
  coocTimer = setInterval(() => void runCommunityJobs(), COOCCURRENCE_INTERVAL_MS);

  purgeTimer = setInterval(() => {
    void purgeExpiredRecoCache().catch(() => undefined);
  }, CACHE_PURGE_INTERVAL_MS);

  // Tendances globales (TMDB ou Vigie) : premier passage 45 s après le
  // démarrage, puis toutes les 12 h — le TTL de 48 h absorbe les redémarrages.
  trendingBootTimer = setTimeout(() => {
    trendingBootTimer = null;
    void runTrending();
  }, TRENDING_BOOT_DELAY_MS);
  trendingTimer = setInterval(() => void runTrending(), TRENDING_INTERVAL_MS);

  // Poussée des notes vers TMDB/AniList (tick 15 s, backoff par ligne).
  startSyncWorkers();
}

async function runTrending(): Promise<void> {
  try {
    const res = await refreshTrending();
    if (res) console.log(`[Reco] Tendances : ${res.count} titres (${res.origin})`);
  } catch (err) {
    console.error("[Reco] Échec du rafraîchissement des tendances :", err);
  }
}

async function runCommunityJobs(): Promise<void> {
  await runCooccurrence();
  try {
    const { titles } = await runServerPulseJob();
    console.log(`[Reco] Pouls serveur : ${titles} titres`);
  } catch (err) {
    console.error("[Reco] Échec du pouls serveur :", err);
  }
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
  if (trendingTimer) { clearInterval(trendingTimer); trendingTimer = null; }
  if (trendingBootTimer) { clearTimeout(trendingBootTimer); trendingBootTimer = null; }
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
      rebuildProfile(userId)
        .then(() => regeneratePoolIfAged(userId))
        .catch((err) =>
          console.error(`[Reco] Rebuild du profil ${userId.slice(0, 8)}… en échec :`, err)
        );
    }, POKE_DEBOUNCE_MS)
  );
}

/**
 * Après un rebuild de profil : régénère le pool s'il a passé la garde d'âge.
 * REMPLACEMENT, jamais d'invalidation — aucun trou de service. Pool absent :
 * rien à faire, la prochaine visite le générera de toute façon.
 */
async function regeneratePoolIfAged(userId: string): Promise<void> {
  const pool = await readPool(userId);
  if (!pool) return;
  const age = Date.now() - Date.parse(pool.generatedAt);
  if (Number.isFinite(age) && age < POOL_REGEN_MIN_AGE_MS) return;
  await generatePool(userId);
}

/** Purge périodique du cache de rangées expiré (partagée avec la Phase 5). */
export async function purgeExpiredRecoCache(): Promise<number> {
  const prisma = getPrisma();
  const res = await prisma.recommendationCache.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return res.count;
}
