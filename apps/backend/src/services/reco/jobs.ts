import { getPrisma } from "../db";
import { loadIdfFromDb, recomputeIdf } from "./idfStore";
import { rebuildProfile } from "./profileBuilder";

// Même doctrine que les autres workers : setInterval dans le process Fastify,
// un couple start/stop, timers mémorisés au module. Pas de cron, pas de file.

const IDF_INTERVAL_MS = 24 * 3600_000;
const IDF_BOOT_DELAY_MS = 30_000;
const POKE_DEBOUNCE_MS = 8_000;

let idfTimer: NodeJS.Timeout | null = null;
let idfBootTimer: NodeJS.Timeout | null = null;
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
}

export function stopRecoJobs(): void {
  if (idfTimer) { clearInterval(idfTimer); idfTimer = null; }
  if (idfBootTimer) { clearTimeout(idfBootTimer); idfBootTimer = null; }
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
