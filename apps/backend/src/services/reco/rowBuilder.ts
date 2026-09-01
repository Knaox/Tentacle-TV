import type { PoolEntry, PoolPayload } from "./generationJob";
import { explorationQuota, noveltyOf, pickExplorationKeys } from "./exploration";
import { selectWithMmr } from "./mmr";
import { pickDaily } from "./seedRotation";
import type { TasteVector } from "./scoring/strategy";

/** Une raison lisible de la présence d'un titre (explicabilité ET debug). */
export interface RecoReason {
  kind: "facet" | "seed" | "exploration";
  /** Clé de facette brute — le client la localise par préfixe. */
  key?: string;
  /** Libellé humain quand le serveur le connaît (personnes, genres…). */
  label?: string;
  seedTitle?: string;
}

export interface RecoRowItem {
  key: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  /** Visuel large TMDB pour le carrousel héros (null : backdrop Jellyfin ou rien). */
  backdropPath: string | null;
  /** null = hors bibliothèque (badge + navigation Vigie côté client). */
  jellyfinItemId: string | null;
  source: string;
  score: number;
  voteAverage: number | null;
  reasons: RecoReason[];
  exploration?: boolean;
}

export interface BuiltRow {
  key: string;
  items: RecoRowItem[];
  seedTitle?: string;
  generatedAt: string;
}

export interface RowBuildOptions {
  /** Exclusions au moment du SERVICE (notes actives + feedback) — un titre
   *  noté ou refusé disparaît immédiatement, sans attendre la régénération. */
  exclude: ReadonlySet<string>;
  vigieAvailable: boolean;
  /** Réglage « Inclure les titres hors bibliothèque » à false : AUCUNE rangée
   *  ne sert de titre sans jellyfinItemId — le libellé fait enfin foi. */
  inLibraryOnly: boolean;
  /** λ du MMR (curseur « Sûr ↔ Aventureux » / 100). */
  lambda: number;
  profile: TasteVector;
}

const ROW_SIZES: Record<string, number> = {
  forYou: 30,
  inLibrary: 24,
  discover: 24,
  exploration: 20,
};
const BECAUSE_SIZE = 18;
const BECAUSE_MIN_ITEMS = 6;
const BECAUSE_ROWS_MAX = 3;
/** Le MMR travaille sur le haut du pool — au-delà, c'est du bruit coûteux. */
const MMR_INPUT_MAX = 150;

const REASONS_MAX = 2;

function toItem(entry: PoolEntry, labels: Record<string, string>): RecoRowItem {
  const { candidate, breakdown } = entry;
  const reasons: RecoReason[] = [];
  for (const contributor of breakdown.topContributors) {
    if (contributor.contribution <= 0) continue;
    reasons.push({ kind: "facet", key: contributor.key, label: labels[contributor.key] });
    if (reasons.length >= REASONS_MAX) break;
  }
  return {
    key: candidate.key,
    mediaType: candidate.mediaType,
    tmdbId: candidate.tmdbId,
    title: candidate.title,
    year: candidate.year,
    posterPath: candidate.posterPath ?? null,
    backdropPath: candidate.backdropPath ?? null,
    jellyfinItemId: candidate.jellyfinItemId ?? null,
    source: candidate.source,
    score: breakdown.total,
    voteAverage: candidate.voteAverage,
    reasons,
  };
}

function mmrPick(entries: PoolEntry[], count: number, lambda: number): PoolEntry[] {
  const input = entries.slice(0, MMR_INPUT_MAX);
  const byKey = new Map(input.map((e) => [e.candidate.key, e]));
  const picked = selectWithMmr(
    input.map((e) => ({
      key: e.candidate.key,
      score: e.breakdown.total,
      facetKeys: new Set(e.candidate.facets.map((f) => f.key)),
    })),
    count,
    lambda
  );
  return picked.map((key) => byKey.get(key)!).filter(Boolean);
}

function explorationPicks(
  eligible: PoolEntry[],
  profile: TasteVector,
  count: number,
  alreadyPicked: ReadonlySet<string>
): PoolEntry[] {
  const byKey = new Map(eligible.map((e) => [e.candidate.key, e]));
  const picked = pickExplorationKeys(
    eligible
      .filter((e) => !alreadyPicked.has(e.candidate.key))
      .map((e) => ({
        key: e.candidate.key,
        novelty: noveltyOf(profile, e.candidate.facets.map((f) => f.key)),
        quality: e.breakdown.quality,
      })),
    count
  );
  return picked.map((key) => byKey.get(key)!).filter(Boolean);
}

/** Les rangées disponibles pour CE pool, dans l'ordre d'affichage. */
export function availableRows(
  pool: PoolPayload,
  opts: Pick<RowBuildOptions, "vigieAvailable" | "inLibraryOnly"> & { userId: string }
): Array<{ key: string; seedTitle?: string }> {
  const rows: Array<{ key: string; seedTitle?: string }> = [{ key: "forYou" }, { key: "inLibrary" }];
  if (opts.vigieAvailable) rows.push({ key: "discover" });

  // Graines éligibles (titrées, assez de candidats), puis TIRAGE QUOTIDIEN
  // pondéré par force — les « 3 premières » figées montraient toujours les
  // mêmes rangées pendant six heures... et souvent des semaines. `buildRow`
  // reste permissif : il sert toute rangée à ≥ 6 items, même hors tirage du
  // jour (le client peut tenir une liste d'hier).
  const eligible: Array<{ key: string; strength: number; seedTitle: string }> = [];
  for (const seed of pool.seeds) {
    if (!seed.title) continue;
    const seedKey = `${seed.mediaType}:${seed.tmdbId}`;
    // En bibliothèque seule, seuls les candidats rattachés comptent : une
    // rangée annoncée doit pouvoir se remplir.
    const related = pool.entries.filter(
      (e) => e.candidate.seedKey === seedKey && (!opts.inLibraryOnly || e.candidate.jellyfinItemId)
    );
    if (related.length < BECAUSE_MIN_ITEMS) continue;
    eligible.push({ key: seedKey, strength: seed.strength, seedTitle: seed.title });
  }
  for (const pick of pickDaily(eligible, opts.userId, BECAUSE_ROWS_MAX)) {
    rows.push({ key: `becauseYouLiked:${pick.key}`, seedTitle: pick.seedTitle });
  }

  rows.push({ key: "community" }, { key: "exploration" });
  return rows;
}

/**
 * Construit UNE rangée depuis le pool en cache. Dérivée à chaque service (pas
 * de cache par rangée) : les exclusions du moment — note posée il y a dix
 * secondes, « ne plus me proposer » — s'appliquent sans invalidation.
 * `community` est servie ailleurs (Phase 6, table de cooccurrences).
 */
export function buildRow(pool: PoolPayload, rowKey: string, opts: RowBuildOptions): BuiltRow | null {
  const eligible = pool.entries.filter(
    (e) =>
      !opts.exclude.has(e.candidate.key) &&
      (!opts.inLibraryOnly || e.candidate.jellyfinItemId)
  );
  const exploReason: RecoReason = { kind: "exploration" };
  const done = (items: PoolEntry[], seedTitle?: string, exploration = false): BuiltRow => ({
    key: rowKey,
    seedTitle,
    generatedAt: pool.generatedAt,
    items: items.map((e) => {
      const item = toItem(e, pool.labels);
      if (exploration) {
        item.exploration = true;
        item.reasons = [exploReason, ...item.reasons].slice(0, REASONS_MAX);
      }
      return item;
    }),
  });

  if (rowKey === "forYou") {
    const size = ROW_SIZES.forYou;
    const quota = Math.round(size * explorationQuota(opts.lambda * 100));
    const main = mmrPick(eligible, size - quota, opts.lambda);
    const mainKeys = new Set(main.map((e) => e.candidate.key));
    const explo = explorationPicks(eligible, opts.profile, quota, mainKeys);
    const row = done(main);
    for (const e of explo) {
      const item = toItem(e, pool.labels);
      item.exploration = true;
      item.reasons = [exploReason, ...item.reasons].slice(0, REASONS_MAX);
      row.items.push(item);
    }
    return row;
  }

  if (rowKey === "inLibrary") {
    return done(mmrPick(eligible.filter((e) => e.candidate.jellyfinItemId), ROW_SIZES.inLibrary, opts.lambda));
  }

  if (rowKey === "discover") {
    if (!opts.vigieAvailable) return null;
    return done(mmrPick(eligible.filter((e) => !e.candidate.jellyfinItemId), ROW_SIZES.discover, opts.lambda));
  }

  if (rowKey.startsWith("becauseYouLiked:")) {
    const seedKey = rowKey.slice("becauseYouLiked:".length);
    const seed = pool.seeds.find((s) => `${s.mediaType}:${s.tmdbId}` === seedKey);
    if (!seed) return null;
    const related = eligible.filter((e) => e.candidate.seedKey === seedKey);
    if (related.length < BECAUSE_MIN_ITEMS) return null;
    const seedReason: RecoReason = { kind: "seed", seedTitle: seed.title };
    const row = done(mmrPick(related, BECAUSE_SIZE, opts.lambda), seed.title);
    for (const item of row.items) {
      item.reasons = [seedReason, ...item.reasons].slice(0, REASONS_MAX);
    }
    return row;
  }

  if (rowKey === "exploration") {
    return done(explorationPicks(eligible, opts.profile, ROW_SIZES.exploration, new Set()), undefined, true);
  }

  return null;
}
