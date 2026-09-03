import type { PoolEntry, PoolPayload } from "./generationJob";
import { explorationQuota } from "./exploration";
import { ANIME_COMMON_FACETS, ANIME_MIN_SHARE, ANIME_UNIVERSE_KEY } from "./facets";
import { explorationPicks, isAnimeEntry, mmrPick, pickWithUniverseQuota } from "./rowSelection";
import { pickDaily } from "./seedRotation";
import type { TasteVector } from "./scoring/strategy";
import { REASONS_MAX, toItem } from "./rowItem";
import type { BuiltRow, RecoReason } from "./rowItem";
import type { ProviderRef } from "../tmdb/providerNormalize";

// Les types des items servis vivent dans rowItem ; ré-exportés pour les
// importeurs historiques (attachProviders, rangées globales…).
export type { BuiltRow, RecoReason, RecoRowItem } from "./rowItem";

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
  /** Nom et logo d'un id de plateforme (annuaire mondial) — les entrées du
   *  pool ne portent que des ids. Absent : références nues. */
  providerRefOf?: (id: number) => ProviderRef;
}

const ROW_SIZES: Record<string, number> = {
  forYou: 30,
  inLibrary: 24,
  discover: 24,
  anime: 24,
  exploration: 20,
};
const BECAUSE_SIZE = 18;
const BECAUSE_MIN_ITEMS = 6;
/** « Animés pour vous » : même plancher qu'une rangée « Parce que… ». */
const ANIME_ROW_MIN_ITEMS = 6;
const BECAUSE_ROWS_MAX = 3;
const ACTOR_ROWS_MAX = 2;

/** Les rangées disponibles pour CE pool, dans l'ordre d'affichage. */
export function availableRows(
  pool: PoolPayload,
  opts: Pick<RowBuildOptions, "vigieAvailable" | "inLibraryOnly"> & {
    userId: string;
    /** Jour UTC du tirage — celui du snapshot en construction, pour que la
     *  page et sa date de péremption disent la même chose. */
    dayStamp?: string;
  }
): Array<{ key: string; seedTitle?: string }> {
  const rows: Array<{ key: string; seedTitle?: string }> = [{ key: "forYou" }, { key: "inLibrary" }];
  // « Animés pour vous » : dès que l'univers pèse (part au seuil) et qu'il y a
  // de quoi remplir — avant « À découvrir », l'ancre des Tendances.
  if ((pool.animeShare ?? 0) >= ANIME_MIN_SHARE) {
    const anime = pool.entries.filter(
      (e) => isAnimeEntry(e) && (!opts.inLibraryOnly || e.candidate.jellyfinItemId)
    );
    if (anime.length >= ANIME_ROW_MIN_ITEMS) rows.push({ key: "anime" });
  }
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
  for (const pick of pickDaily(eligible, opts.userId, BECAUSE_ROWS_MAX, opts.dayStamp)) {
    rows.push({ key: `becauseYouLiked:${pick.key}`, seedTitle: pick.seedTitle });
  }

  // Rangées « Avec {acteur} » : même mécanique que les « Parce que… »,
  // rotation quotidienne salée à part (les deux tirages sont indépendants).
  const actors: Array<{ key: string; strength: number; seedTitle: string }> = [];
  for (const person of pool.people ?? []) {
    const related = pool.entries.filter(
      (e) =>
        e.candidate.personKey === person.personId &&
        (!opts.inLibraryOnly || e.candidate.jellyfinItemId)
    );
    if (related.length < BECAUSE_MIN_ITEMS) continue;
    actors.push({ key: `withActor:${person.personId}`, strength: 1, seedTitle: person.name });
  }
  for (const pick of pickDaily(actors, `${opts.userId}:actors`, ACTOR_ROWS_MAX, opts.dayStamp)) {
    rows.push({ key: pick.key, seedTitle: pick.seedTitle });
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
  // Part d'animé à la génération : quota des rangées mixtes, rangée dédiée.
  const share = pool.animeShare ?? 0;
  const exploReason: RecoReason = { kind: "exploration" };
  const done = (items: PoolEntry[], seedTitle?: string, exploration = false): BuiltRow => ({
    key: rowKey,
    seedTitle,
    generatedAt: pool.generatedAt,
    items: items.map((e) => {
      const item = toItem(e, pool.labels, opts.providerRefOf);
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
    const main = pickWithUniverseQuota(eligible, size - quota, opts.lambda, share);
    const mainKeys = new Set(main.map((e) => e.candidate.key));
    const explo = explorationPicks(eligible, opts.profile, quota, mainKeys);
    const row = done(main);
    for (const e of explo) {
      const item = toItem(e, pool.labels, opts.providerRefOf);
      item.exploration = true;
      item.reasons = [exploReason, ...item.reasons].slice(0, REASONS_MAX);
      row.items.push(item);
    }
    return row;
  }

  if (rowKey === "inLibrary") {
    const inLibrary = eligible.filter((e) => e.candidate.jellyfinItemId);
    return done(pickWithUniverseQuota(inLibrary, ROW_SIZES.inLibrary, opts.lambda, share));
  }

  if (rowKey === "discover") {
    if (!opts.vigieAvailable) return null;
    const outside = eligible.filter((e) => !e.candidate.jellyfinItemId);
    return done(pickWithUniverseQuota(outside, ROW_SIZES.discover, opts.lambda, share));
  }

  if (rowKey === "anime") {
    const related = eligible.filter(isAnimeEntry);
    if (share < ANIME_MIN_SHARE || related.length < ANIME_ROW_MIN_ITEMS) return null;
    const row = done(mmrPick(related, ROW_SIZES.anime, opts.lambda, ANIME_COMMON_FACETS));
    // « Vous regardez des animés » est le TITRE de la rangée : place aux
    // raisons spécifiques (thème, studio, décennie).
    for (const item of row.items) {
      item.reasons = item.reasons.filter((r) => r.key !== ANIME_UNIVERSE_KEY);
    }
    return row;
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

  if (rowKey.startsWith("withActor:")) {
    const personId = Number(rowKey.slice("withActor:".length));
    if (!Number.isFinite(personId)) return null;
    const person = pool.people?.find((p) => p.personId === personId);
    const related = eligible.filter((e) => e.candidate.personKey === personId);
    if (related.length < BECAUSE_MIN_ITEMS) return null;
    const actorReason: RecoReason = { kind: "facet", key: `actor:${personId}`, label: person?.name };
    const row = done(mmrPick(related, BECAUSE_SIZE, opts.lambda), person?.name);
    for (const item of row.items) {
      item.reasons = [actorReason, ...item.reasons].slice(0, REASONS_MAX);
    }
    return row;
  }

  if (rowKey === "exploration") {
    return done(explorationPicks(eligible, opts.profile, ROW_SIZES.exploration, new Set()), undefined, true);
  }

  return null;
}
