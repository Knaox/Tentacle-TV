import { getPrisma } from "../db";
import { tmdbConfigured } from "../tmdb/client";
import { deleteTmdbRating, pushTmdbRating } from "../tmdb/guestSession";
import { anilistTokenFor } from "../anilist/oauth";
import { deleteAnilistScore, pushAnilistScore } from "../anilist/client";
import { resolveAnilistId } from "../anilist/idMap";

/**
 * File de sync des notes vers TMDB (guest session) et AniList — côté backend,
 * jamais depuis le client : une note posée hors ligne part à la reconnexion,
 * un échec réseau ne la perd pas. La note est DÉJÀ en base quand on passe ici ;
 * `syncStatus` ne pilote que la poussée externe, l'UI ne bloque jamais dessus.
 *
 * Pas de file de messages : colonnes d'état + tick de 15 s (doctrine
 * notificationPushWorker), backoff exponentiel par ligne, idempotent — pousser
 * deux fois la même note est un ré-écrasement sans effet.
 */

const TICK_MS = 15_000;
const BATCH = 5;
const MAX_ATTEMPTS = 8;

let timer: NodeJS.Timeout | null = null;
let running = false;

function backoffMs(attempts: number): number {
  return Math.min(30_000 * 2 ** attempts, 6 * 3600_000);
}

export function startSyncWorkers(): void {
  if (timer) return;
  timer = setInterval(() => void tick(), TICK_MS);
}

export function stopSyncWorkers(): void {
  if (timer) { clearInterval(timer); timer = null; }
}

async function tick(): Promise<void> {
  if (running) return; // un lot à la fois — le suivant attend son tick
  running = true;
  try {
    await processSyncBatch();
  } catch (err) {
    console.error("[Reco] Worker de sync en échec :", err);
  } finally {
    running = false;
  }
}

export async function processSyncBatch(): Promise<number> {
  const prisma = getPrisma();
  const rows = await prisma.userRating.findMany({
    where: {
      syncStatus: { in: ["pending", "delete_pending"] },
      nextSyncAt: { lte: new Date() },
    },
    orderBy: { updatedAt: "asc" },
    take: BATCH,
  });

  for (const row of rows) {
    try {
      if (row.syncStatus === "delete_pending") await processDelete(row);
      else await processPush(row);
    } catch (err) {
      const attempts = row.syncAttempts + 1;
      const exhausted = attempts >= MAX_ATTEMPTS;
      await prisma.userRating.update({
        where: { id: row.id },
        data: {
          syncAttempts: attempts,
          // Épuisé → « failed », visible dans l'UI et rejouable à la main ;
          // sinon backoff exponentiel.
          syncStatus: exhausted ? "failed" : row.syncStatus,
          nextSyncAt: exhausted ? null : new Date(Date.now() + backoffMs(attempts)),
        },
      });
      console.warn(
        `[Reco] Sync de ${row.mediaType}:${row.tmdbId} en échec (tentative ${attempts}) :`,
        err instanceof Error ? err.message : err
      );
    }
  }
  return rows.length;
}

type RatingRow = Awaited<ReturnType<ReturnType<typeof getPrisma>["userRating"]["findMany"]>>[number];

/** L'identifiant AniList de la ligne : colonne, sinon résolution mappée. */
async function anilistIdFor(row: RatingRow): Promise<number | null> {
  if (row.mediaType === "episode") return null; // AniList note le média, pas l'épisode
  if (row.anilistId != null) return row.anilistId;
  const mediaType = row.mediaType === "movie" ? "movie" : "tv";
  const resolution = await resolveAnilistId(mediaType, row.tmdbId, row.tvdbId);
  return resolution.anilistId;
}

async function processPush(row: RatingRow): Promise<void> {
  const prisma = getPrisma();
  const data: Record<string, unknown> = {};

  const tmdbApplicable = tmdbConfigured();
  if (tmdbApplicable) {
    await pushTmdbRating(row.jellyfinUserId, row, row.score);
    data.tmdbSyncedAt = new Date();
  }

  // AniList : seulement un compte lié — et la présence dans le mapping vaut
  // détection « c'est un animé » (plus fiable que les genres).
  const token = await anilistTokenFor(row.jellyfinUserId);
  let anilistApplicable = false;
  if (token) {
    const anilistId = await anilistIdFor(row);
    if (anilistId != null) {
      anilistApplicable = true;
      await pushAnilistScore(token, anilistId, row.score);
      data.anilistSyncedAt = new Date();
      data.anilistId = anilistId;
      data.isAnime = true;
    }
  }

  await prisma.userRating.update({
    where: { id: row.id },
    data: {
      ...data,
      // Aucune cible applicable : « disabled » — rien à pousser nulle part.
      // Un resync manuel (ou une nouvelle note) réévaluera.
      syncStatus: tmdbApplicable || anilistApplicable ? "synced" : "disabled",
      syncAttempts: 0,
      nextSyncAt: null,
    },
  });
}

async function processDelete(row: RatingRow): Promise<void> {
  const prisma = getPrisma();
  if (row.tmdbSyncedAt && tmdbConfigured()) {
    await deleteTmdbRating(row.jellyfinUserId, row);
  }
  if (row.anilistSyncedAt && row.anilistId != null) {
    const token = await anilistTokenFor(row.jellyfinUserId);
    if (token) await deleteAnilistScore(token, row.anilistId);
  }
  // Les cibles distantes sont propres : la ligne locale peut disparaître.
  await prisma.userRating.delete({ where: { id: row.id } });
}
