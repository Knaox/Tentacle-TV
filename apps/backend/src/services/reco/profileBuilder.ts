import { getPrisma } from "../db";
import { getCachedMetaMany, getTitleMeta } from "../tmdb/metaCache";
import type { TitleMeta } from "../tmdb/metaCache";
import { facetsFromJellyfin, facetsFromTmdb } from "./facets";
import {
  SIGNAL_ABANDON,
  SIGNAL_COMPLETED,
  SIGNAL_FAVORITE,
  SIGNAL_REWATCH,
  SIGNAL_SERIES_FOLLOWED,
  SIGNAL_WATCHLISTED,
  ageInDays,
  buildFacetVector,
  ratingSignalWeight,
  ratingStats,
  truncateVector,
} from "./profileMath";
import type { WeightedSignal } from "./profileMath";
import { fetchUserSignals, tmdbIdOf } from "./signals";
import type { SignalItem } from "./signals";
import { idfFor, idfLoadedAt, loadIdfFromDb } from "./idfStore";

/** Appels TMDB au plus par reconstruction : le reste passe par le cache ou le
 *  repli Jellyfin — la reconstruction suivante reprendra où celle-ci s'arrête. */
const TMDB_FETCH_BUDGET = 40;
const PROFILE_MAX_FACETS = 400;
const PROFILE_SCHEMA_VERSION = 1;

const ABANDON_MAX_PROGRESS = 0.25;
const ABANDON_MIN_IDLE_DAYS = 30;
const FOLLOWED_MIN_EPISODES = 3;

interface TmdbRef {
  mediaType: "movie" | "tv";
  tmdbId: number;
}

/** Un signal en attente d'enrichissement : identité TMDB et/ou repli Jellyfin. */
interface PendingSignal {
  weight: number;
  ageDays: number;
  tmdb: TmdbRef | null;
  fallback: SignalItem | null;
}

function tmdbTypeOf(item: SignalItem): "movie" | "tv" | null {
  if (item.Type === "Movie") return "movie";
  if (item.Type === "Series") return "tv";
  return null;
}

function refOf(item: SignalItem): TmdbRef | null {
  const mediaType = tmdbTypeOf(item);
  const tmdbId = tmdbIdOf(item);
  return mediaType && tmdbId ? { mediaType, tmdbId } : null;
}

// Une reconstruction à la fois par compte : les pokes en rafale s'écrasent.
const inFlight = new Map<string, Promise<ProfileSummary>>();

export interface ProfileSummary {
  signalCount: number;
  facetCount: number;
  ratingMean: number;
  ratingStdDev: number;
}

export async function rebuildProfile(userId: string): Promise<ProfileSummary> {
  const pending = inFlight.get(userId);
  if (pending) return pending;
  const p = doRebuild(userId).finally(() => inFlight.delete(userId));
  inFlight.set(userId, p);
  return p;
}

/** Une reconstruction est-elle en cours pour ce compte ? (endpoint de statut) */
export function isRebuilding(userId: string): boolean {
  return inFlight.has(userId);
}

/** La reconstruction en cours, s'il y en a une — la chaîne du pool s'y adosse
 *  pour ne jamais générer sur un profil encore vide. Ne rejette jamais. */
export function awaitRebuild(userId: string): Promise<unknown> {
  const pending = inFlight.get(userId);
  return pending ? pending.catch(() => undefined) : Promise.resolve();
}

async function doRebuild(userId: string): Promise<ProfileSummary> {
  const prisma = getPrisma();
  if (idfLoadedAt() === 0) await loadIdfFromDb();

  const [ratings, signals] = await Promise.all([
    prisma.userRating.findMany({ where: { jellyfinUserId: userId, deletedAt: null } }),
    fetchUserSignals(userId),
  ]);

  const { mean, stdDev } = ratingStats(ratings.map((r) => r.score));
  const pendings: PendingSignal[] = [];

  // Index (mediaType, tmdbId) -> item de bibliothèque : le repli des notes
  // quand TMDB est muet — un titre noté ET en bibliothèque garde ses facettes.
  const libraryByRef = new Map<string, SignalItem>();
  const indexItem = (item: SignalItem) => {
    const ref = refOf(item);
    if (ref) libraryByRef.set(`${ref.mediaType}:${ref.tmdbId}`, item);
  };
  signals.favorites.forEach(indexItem);
  signals.watchlist.forEach(indexItem);
  signals.playedMovies.forEach(indexItem);
  signals.seriesById.forEach(indexItem);

  // 1) Notes explicites, normalisées sur l'échelle personnelle.
  for (const r of ratings) {
    const mediaType = r.mediaType === "movie" ? "movie" : "tv";
    pendings.push({
      weight: ratingSignalWeight(r.score, mean, stdDev),
      ageDays: ageInDays(r.updatedAt),
      tmdb: { mediaType, tmdbId: r.tmdbId },
      fallback: libraryByRef.get(`${mediaType}:${r.tmdbId}`) ?? null,
    });
  }

  // 2) Favoris (like fort) et Ma liste (intérêt) — pas de date chez Jellyfin.
  for (const item of signals.favorites) {
    pendings.push({ weight: SIGNAL_FAVORITE, ageDays: 0, tmdb: refOf(item), fallback: item });
  }
  for (const item of signals.watchlist) {
    pendings.push({ weight: SIGNAL_WATCHLISTED, ageDays: 0, tmdb: refOf(item), fallback: item });
  }

  // 3) Films vus (terminé +0.5) et revus (PlayCount >= 2, +0.9).
  for (const item of signals.playedMovies) {
    const age = item.UserData?.LastPlayedDate ? ageInDays(item.UserData.LastPlayedDate) : 0;
    pendings.push({ weight: SIGNAL_COMPLETED, ageDays: age, tmdb: refOf(item), fallback: item });
    if ((item.UserData?.PlayCount ?? 0) >= 2) {
      pendings.push({ weight: SIGNAL_REWATCH, ageDays: age, tmdb: refOf(item), fallback: item });
    }
  }

  // 4) Abandons : < 25 % de progression, non repris depuis 30 jours. Un
  //    épisode abandonné pénalise sa SÉRIE (c'est elle qu'on recommande).
  for (const item of signals.resumable) {
    const pos = item.UserData?.PlaybackPositionTicks ?? 0;
    const runtime = item.RunTimeTicks ?? 0;
    const last = item.UserData?.LastPlayedDate;
    if (runtime <= 0 || !last) continue;
    const progress = pos / runtime;
    const idleDays = ageInDays(last);
    if (progress >= ABANDON_MAX_PROGRESS || idleDays < ABANDON_MIN_IDLE_DAYS) continue;
    const target = item.Type === "Episode" && item.SeriesId
      ? signals.seriesById.get(item.SeriesId) ?? null
      : item;
    if (!target) continue;
    pendings.push({
      weight: SIGNAL_ABANDON,
      ageDays: idleDays,
      tmdb: refOf(target),
      fallback: target,
    });
  }

  // 5) Séries suivies : au moins 3 épisodes vus.
  for (const [seriesId, count] of signals.episodesPlayedBySeries) {
    if (count < FOLLOWED_MIN_EPISODES) continue;
    const series = signals.seriesById.get(seriesId);
    if (!series) continue;
    pendings.push({ weight: SIGNAL_SERIES_FOLLOWED, ageDays: 0, tmdb: refOf(series), fallback: series });
  }

  // Enrichissement TMDB sous budget : le cache est gratuit, les fetchs vont
  // d'abord aux titres au signal le plus fort.
  const metaByRef = await resolveMeta(pendings);

  const weighted: WeightedSignal[] = [];
  for (const p of pendings) {
    const meta = p.tmdb ? metaByRef.get(`${p.tmdb.mediaType}:${p.tmdb.tmdbId}`) : undefined;
    const facets = meta ? facetsFromTmdb(meta) : p.fallback ? facetsFromJellyfin(p.fallback) : [];
    if (facets.length === 0) continue;
    weighted.push({ weight: p.weight, ageDays: p.ageDays, facets });
  }

  const vector = truncateVector(buildFacetVector(weighted, idfFor), PROFILE_MAX_FACETS);
  const facetCount = Object.keys(vector).length;

  await prisma.tasteProfile.upsert({
    where: { jellyfinUserId: userId },
    create: {
      jellyfinUserId: userId,
      facets: JSON.stringify(vector),
      signalCount: weighted.length,
      ratingMean: mean,
      ratingStdDev: stdDev,
      schemaVersion: PROFILE_SCHEMA_VERSION,
    },
    update: {
      facets: JSON.stringify(vector),
      signalCount: weighted.length,
      ratingMean: mean,
      ratingStdDev: stdDev,
      schemaVersion: PROFILE_SCHEMA_VERSION,
      computedAt: new Date(),
    },
  });

  return { signalCount: weighted.length, facetCount, ratingMean: mean, ratingStdDev: stdDev };
}

async function resolveMeta(pendings: PendingSignal[]): Promise<Map<string, TitleMeta>> {
  // Poids maximal par identité : les fetchs frais vont aux titres marquants.
  const strength = new Map<string, { ref: TmdbRef; max: number }>();
  for (const p of pendings) {
    if (!p.tmdb) continue;
    const key = `${p.tmdb.mediaType}:${p.tmdb.tmdbId}`;
    const cur = strength.get(key);
    const abs = Math.abs(p.weight);
    if (!cur || abs > cur.max) strength.set(key, { ref: p.tmdb, max: abs });
  }

  // Une seule lecture groupée du cache — la boucle par titre coûtait une
  // requête Prisma par identité sur un historique fourni.
  const out = await getCachedMetaMany([...strength.values()].map((s) => s.ref));
  const misses: Array<{ key: string; ref: TmdbRef; max: number }> = [];
  for (const [key, { ref, max }] of strength) {
    if (!out.has(key)) misses.push({ key, ref, max });
  }

  misses.sort((a, b) => b.max - a.max);
  for (const { key, ref } of misses.slice(0, TMDB_FETCH_BUDGET)) {
    const meta = await getTitleMeta(ref.mediaType, ref.tmdbId);
    if (meta) out.set(key, meta);
  }
  return out;
}

/** Le profil stocké, facettes parsées (pour l'endpoint de debug). */
export async function getProfileDebug(userId: string): Promise<{
  exists: boolean;
  signalCount: number;
  ratingMean: number;
  ratingStdDev: number;
  computedAt: string | null;
  topFacets: Array<{ key: string; weight: number }>;
} | null> {
  const prisma = getPrisma();
  const row = await prisma.tasteProfile.findUnique({ where: { jellyfinUserId: userId } });
  if (!row) {
    return { exists: false, signalCount: 0, ratingMean: 0, ratingStdDev: 0, computedAt: null, topFacets: [] };
  }
  let facets: Record<string, number> = {};
  try {
    facets = JSON.parse(row.facets) as Record<string, number>;
  } catch {
    // Vecteur illisible : le debug montre un profil vide, le prochain rebuild réécrit.
  }
  const topFacets = Object.entries(facets)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 50)
    .map(([key, weight]) => ({ key, weight }));
  return {
    exists: true,
    signalCount: row.signalCount,
    ratingMean: row.ratingMean,
    ratingStdDev: row.ratingStdDev,
    computedAt: row.computedAt.toISOString(),
    topFacets,
  };
}
