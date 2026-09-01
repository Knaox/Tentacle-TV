import { getPrisma } from "../db";
import { tmdbConfigured } from "../tmdb/client";
import { getCachedMetaMany, getTitleMeta, metaKey } from "../tmdb/metaCache";
import type { TitleMeta } from "../tmdb/metaCache";
import { facetsFromJellyfin, facetsFromTmdb } from "./facets";
import { idfFor, idfLoadedAt, loadIdfFromDb } from "./idfStore";
import { FacetScoringStrategy } from "./scoring/facetStrategy";
import type { Candidate, ScoreBreakdown, TasteVector } from "./scoring/strategy";
import { buildExclusions } from "./candidates/exclusions";
import type { LibraryIndex } from "./candidates/libraryIndex";
import { getLibraryIndexMemo } from "./candidates/libraryMemo";
import { assemblePool } from "./candidates/pool";
import { deriveSeeds } from "./candidates/seeds";
import { candidatesFromDiscover, candidatesFromSeeds } from "./candidates/tmdbSource";
import type { SeedRef } from "./candidates/tmdbSource";
import { candidatesFromVigie } from "./candidates/vigieSource";
import { candidatesFromAnilist } from "./candidates/anilistSource";

/** Durée de vie du pool en cache — la page relance la génération au-delà. */
const POOL_TTL_MS = 6 * 3600_000;

/** Rangée interne portant le pool classé (jamais servie telle quelle à l'UI). */
export const POOL_ROW_KEY = "pool";

/** Le haut du pré-classement enrichi en métadonnées complètes (keywords…). */
const ENRICH_TOP = 120;
/** Appels TMDB frais au plus par génération — le cache est gratuit. */
const ENRICH_FETCH_BUDGET = 60;

/** Plafond de candidats bibliothèque : les mieux notés d'abord. */
const LIBRARY_POOL_MAX = 300;

export interface PoolEntry {
  candidate: Candidate;
  breakdown: ScoreBreakdown;
}

export interface PoolPayload {
  generatedAt: string;
  strategyId: string;
  poolSize: number;
  seeds: SeedRef[];
  entries: PoolEntry[];
  /** Libellés humains des facettes à IDs (« director:5655 » → nom) pour les
   *  raisons affichées. Décennies/langues/durées se localisent côté client. */
  labels: Record<string, string>;
}

function libraryCandidates(library: LibraryIndex): Candidate[] {
  return library.entries
    .filter((e) => !e.played)
    .sort((a, b) => (b.communityRating ?? 0) - (a.communityRating ?? 0))
    .slice(0, LIBRARY_POOL_MAX)
    .map((e) => ({
      key: e.key,
      mediaType: e.mediaType,
      tmdbId: e.tmdbId,
      title: e.name,
      year: e.ProductionYear ?? null,
      facets: facetsFromJellyfin(e),
      voteAverage: e.communityRating,
      voteCount: null,
      popularity: null,
      source: "library" as const,
      jellyfinItemId: e.itemId,
    }));
}

// Une génération à la fois par compte — la page peut marteler, le job non.
const inFlight = new Map<string, Promise<{ poolSize: number }>>();

export async function generatePool(userId: string): Promise<{ poolSize: number }> {
  const pending = inFlight.get(userId);
  if (pending) return pending;
  const p = doGenerate(userId).finally(() => inFlight.delete(userId));
  inFlight.set(userId, p);
  return p;
}

async function doGenerate(userId: string): Promise<{ poolSize: number }> {
  const prisma = getPrisma();
  if (idfLoadedAt() === 0) await loadIdfFromDb();

  const [profileRow, settingsRow, library] = await Promise.all([
    prisma.tasteProfile.findUnique({ where: { jellyfinUserId: userId } }),
    prisma.recoSettings.findUnique({ where: { jellyfinUserId: userId } }),
    getLibraryIndexMemo(userId),
  ]);

  let facets: Record<string, number> = {};
  try {
    facets = profileRow ? (JSON.parse(profileRow.facets) as Record<string, number>) : {};
  } catch {
    // Profil illisible : pool sur profil vide, le prochain rebuild réécrit.
  }
  const profile: TasteVector = { facets, signalCount: profileRow?.signalCount ?? 0 };
  const includeVigie = settingsRow?.includeVigie ?? true;

  const [exclusions, seeds] = await Promise.all([
    buildExclusions(userId, library),
    deriveSeeds(userId, library),
  ]);

  // Sources — bibliothèque d'abord (elle porte jellyfinItemId), puis les
  // découvertes. Chaque source dégrade en liste vide, jamais en erreur.
  const [fromSeeds, fromDiscover, fromVigie, fromAnilist] = await Promise.all([
    candidatesFromSeeds(seeds),
    candidatesFromDiscover(profile),
    includeVigie ? candidatesFromVigie() : Promise.resolve([]),
    candidatesFromAnilist(userId),
  ]);

  const pool = assemblePool([
    libraryCandidates(library),
    fromSeeds,
    fromAnilist,
    fromVigie,
    fromDiscover,
  ]);

  // Un candidat externe déjà en bibliothèque récupère son jellyfinItemId :
  // c'est lui qui décide de la navigation (fiche Jellyfin, pas fiche Vigie).
  for (const candidate of pool) {
    if (!candidate.jellyfinItemId) {
      const entry = library.byKey.get(candidate.key);
      if (entry) candidate.jellyfinItemId = entry.itemId;
    }
  }

  const kept = pool.filter((c) => !exclusions.everywhere.has(c.key));

  // Pré-classement sur facettes grossières, enrichissement du haut du panier
  // (cache gratuit + budget de fetchs), re-classement final.
  const strategy = new FacetScoringStrategy(idfFor);
  let scored: PoolEntry[] = kept.map((candidate) => ({
    candidate,
    breakdown: strategy.score(profile, candidate),
  }));
  scored.sort(byTotalDesc);

  const labels: Record<string, string> = {};
  const harvestLabels = (meta: TitleMeta) => {
    for (const g of meta.genres) labels[`genre:${g.id}`] = g.name;
    for (const k of meta.keywords) labels[`kw:${k.id}`] = k.name;
    for (const d of meta.directors) if (d.name) labels[`director:${d.id}`] = d.name;
    for (const a of meta.topCast) if (a.name) labels[`actor:${a.id}`] = a.name;
    for (const s of meta.studios) if (s.name) labels[`studio:${s.id}`] = s.name;
    for (const n of meta.networks) if (n.name) labels[`network:${n.id}`] = n.name;
  };
  // Libellés des facettes nommées Jellyfin (slug → intitulé d'origine).
  for (const entry of library.entries) {
    for (const g of entry.Genres ?? []) {
      labels[`genre-name:${g.trim().toLowerCase().replace(/\s+/g, "-")}`] = g;
    }
    for (const s of entry.Studios ?? []) {
      if (s.Name) labels[`studio-name:${s.Name.trim().toLowerCase().replace(/\s+/g, "-")}`] = s.Name;
    }
  }

  let fetchBudget = tmdbConfigured() ? ENRICH_FETCH_BUDGET : 0;
  const enrichTop = scored.slice(0, ENRICH_TOP);
  // Une lecture groupée du cache pour tout le haut du panier — le budget de
  // fetchs frais ne sert qu'aux absents.
  const cachedMeta = await getCachedMetaMany(
    enrichTop.map((e) => ({ mediaType: e.candidate.mediaType, tmdbId: e.candidate.tmdbId }))
  );
  for (const entry of enrichTop) {
    const { candidate } = entry;
    let meta = cachedMeta.get(metaKey(candidate.mediaType, candidate.tmdbId)) ?? null;
    if (!meta && fetchBudget > 0) {
      fetchBudget--;
      meta = await getTitleMeta(candidate.mediaType, candidate.tmdbId);
    }
    if (!meta) continue;
    harvestLabels(meta);
    candidate.facets = facetsFromTmdb(meta);
    candidate.voteAverage = meta.voteAverage ?? candidate.voteAverage;
    candidate.voteCount = meta.voteCount ?? candidate.voteCount;
    candidate.popularity = meta.popularity ?? candidate.popularity;
    candidate.year = meta.year ?? candidate.year;
    entry.breakdown = strategy.score(profile, candidate);
  }
  scored.sort(byTotalDesc);
  scored = scored.slice(0, 1000);

  const payload: PoolPayload = {
    generatedAt: new Date().toISOString(),
    strategyId: strategy.id,
    poolSize: scored.length,
    seeds,
    entries: scored,
    labels,
  };

  await prisma.recommendationCache.upsert({
    where: { jellyfinUserId_rowKey: { jellyfinUserId: userId, rowKey: POOL_ROW_KEY } },
    create: {
      jellyfinUserId: userId,
      rowKey: POOL_ROW_KEY,
      payload: JSON.stringify(payload),
      expiresAt: new Date(Date.now() + POOL_TTL_MS),
    },
    update: {
      payload: JSON.stringify(payload),
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + POOL_TTL_MS),
    },
  });

  return { poolSize: scored.length };
}

function byTotalDesc(a: PoolEntry, b: PoolEntry): number {
  return b.breakdown.total - a.breakdown.total || (a.candidate.key < b.candidate.key ? -1 : 1);
}

/** Le pool en cache, ou null (absent/expiré/illisible). */
export async function readPool(userId: string): Promise<PoolPayload | null> {
  const prisma = getPrisma();
  const row = await prisma.recommendationCache.findUnique({
    where: { jellyfinUserId_rowKey: { jellyfinUserId: userId, rowKey: POOL_ROW_KEY } },
  });
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  try {
    return JSON.parse(row.payload) as PoolPayload;
  } catch {
    return null;
  }
}

/**
 * Garantit un pool : frais → rien à faire ; absent/expiré → génération lancée
 * EN FOND (la requête HTTP ne l'attend jamais) et l'appelant sert ce qu'il a.
 */
export async function ensureFreshPool(
  userId: string
): Promise<{ status: "fresh" | "generating"; pool: PoolPayload | null }> {
  const pool = await readPool(userId);
  if (pool) return { status: "fresh", pool };
  void generatePool(userId).catch((err) =>
    console.error(`[Reco] Génération du pool ${userId.slice(0, 8)}… en échec :`, err)
  );
  return { status: "generating", pool: null };
}
