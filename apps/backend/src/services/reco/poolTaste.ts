import { getCachedMetaMany, metaKey } from "../tmdb/metaCache";
import type { TitleMeta } from "../tmdb/metaCache";
import type { Anchor } from "./anchors";
import { parseAnchors } from "./anchorStore";
import type { StoredAnchor } from "./anchorStore";
import type { LibraryIndex } from "./candidates/libraryIndex";
import { isReleasedOn } from "./candidates/released";
import { deriveSeeds } from "./candidates/seeds";
import type { SeedRef } from "./candidates/tmdbSource";
import { facetsFromTmdb } from "./facets";
import { idfFor } from "./idfStore";
import { FacetScoringStrategy } from "./scoring/facetStrategy";
import type { Candidate, ScoringStrategy } from "./scoring/strategy";
import { TasteScoringStrategy } from "./scoring/tasteStrategy";
import { pickSeeds } from "./seedPicker";
import { buildTasteIndex, consumptionShares, recencyAffinity } from "./tasteModel";

/**
 * Ce que la génération du pool tire du profil : la stratégie de classement,
 * les graines, et le soutien collaboratif des ancres (leurs voisins TMDB).
 * Un profil d'avant les ancres garde l'ancienne mécanique jusqu'à sa
 * reconstruction (le fan-out de boot s'en charge).
 */
export interface PoolTaste {
  strategy: ScoringStrategy;
  seeds: SeedRef[];
  /** clé candidate → soutien cumulé des ancres qui la recommandent. */
  neighborSupport: Map<string, { support: number; anchorKey: string }>;
}

/** Ancres dont on suit les voisins collaboratifs (les plus fortes). */
const NEIGHBOR_ANCHORS_MAX = 150;
/** Un rang TMDB de 0 à 19 : le premier voisin pèse deux fois le vingtième. */
const RANK_SPAN = 40;
/** Voisins sans fiche en cache ajoutés au panier, au plus. */
const NEIGHBOR_CANDIDATES_MAX = 600;

function watchlistOnly(a: Anchor): boolean {
  return a.kinds.length === 1 && a.kinds[0] === "watchlist";
}

export async function preparePoolTaste(
  userId: string,
  row: { anchors: string | null } | null,
  library: LibraryIndex
): Promise<PoolTaste> {
  const anchors = parseAnchors(row?.anchors);
  if (!anchors || anchors.length === 0) {
    return {
      strategy: new FacetScoringStrategy(idfFor),
      seeds: await deriveSeeds(userId, library),
      neighborSupport: new Map(),
    };
  }

  const metas = await getCachedMetaMany(
    anchors.filter((a) => a.tmdbId > 0).map((a) => ({ mediaType: a.mediaType, tmdbId: a.tmdbId }))
  );
  const metaOf = (a: Anchor): TitleMeta | undefined => metas.get(a.key);
  const facetsOf = (a: StoredAnchor) => a.facets ?? (metaOf(a) ? facetsFromTmdb(metaOf(a)!) : null);
  for (const a of anchors) if (!a.title) a.title = metaOf(a)?.title ?? library.byKey.get(a.key)?.name ?? "";

  const nowYear = new Date().getFullYear();
  const shares = consumptionShares(anchors);
  const seeds = pickSeeds(anchors, facetsOf, { shares, now: Date.now() });
  const seedKeys = new Set(seeds.map((s) => `${s.mediaType}:${s.tmdbId}`));

  // Voisins collaboratifs des ancres fortes (hors graines : leurs listes
  // arrivent fraîches de TMDB dans candidatesFromSeeds).
  const neighborSupport = new Map<string, { support: number; anchorKey: string; best: number }>();
  const sources = anchors
    .filter((a) => a.weight > 0 && a.tmdbId > 0 && !watchlistOnly(a) && !seedKeys.has(a.key))
    .slice(0, NEIGHBOR_ANCHORS_MAX);
  for (const a of sources) {
    const neighbors = metaOf(a)?.recommendations ?? [];
    for (const [rank, n] of neighbors.entries()) {
      const key = metaKey(n.mediaType, n.tmdbId);
      const add = a.weight * (1 - rank / RANK_SPAN);
      const cur = neighborSupport.get(key);
      if (!cur) neighborSupport.set(key, { support: add, anchorKey: a.key, best: add });
      else {
        cur.support += add;
        if (add > cur.best) Object.assign(cur, { anchorKey: a.key, best: add });
      }
    }
  }

  const index = buildTasteIndex(anchors, facetsOf, idfFor);
  const strategy = new TasteScoringStrategy({
    index,
    idfFor,
    nowYear,
    recencyAffinity: recencyAffinity(anchors, (a) => metaOf(a)?.year ?? null, nowYear),
  });
  return { strategy, seeds, neighborSupport };
}

/**
 * Les voisins collaboratifs deviennent des candidats — CACHE SEUL (zéro
 * réseau, donc servis dès la passe rapide) : sans fiche, un titre n'a ni
 * facettes ni affiche. Les plus soutenus d'abord ; sortis seulement.
 */
export async function candidatesFromNeighbors(taste: PoolTaste): Promise<Candidate[]> {
  const ranked = [...taste.neighborSupport.entries()]
    .sort((a, b) => b[1].support - a[1].support)
    .slice(0, NEIGHBOR_CANDIDATES_MAX);
  const refs = ranked.map(([key]) => {
    const [mediaType, id] = key.split(":");
    return { mediaType: mediaType as "movie" | "tv", tmdbId: Number(id) };
  });
  const metas = await getCachedMetaMany(refs);
  const seedKeys = new Set(taste.seeds.map((s) => `${s.mediaType}:${s.tmdbId}`));
  const out: Candidate[] = [];
  for (const [key, n] of ranked) {
    const meta = metas.get(key);
    if (!meta || !isReleasedOn(meta.releaseDate)) continue;
    out.push({
      key,
      mediaType: meta.mediaType,
      tmdbId: meta.tmdbId,
      title: meta.title,
      year: meta.year,
      facets: facetsFromTmdb(meta),
      voteAverage: meta.voteAverage,
      voteCount: meta.voteCount,
      popularity: meta.popularity,
      source: "tmdb_rec",
      posterPath: meta.posterPath,
      backdropPath: meta.backdropPath,
      seedKey: seedKeys.has(n.anchorKey) ? n.anchorKey : null,
    });
  }
  return out;
}

/** Le soutien collaboratif rejoint celui des graines, quelle que soit la
 *  source qui a apporté le candidat (bibliothèque comprise). */
export function applyNeighborSupport(candidates: Candidate[], taste: PoolTaste): void {
  for (const c of candidates) {
    const n = taste.neighborSupport.get(c.key);
    if (n) c.seedSupport = (c.seedSupport ?? 0) + n.support;
  }
}
