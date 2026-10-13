import type { PoolEntry, PoolPayload } from "./generationJob";
import { explorationQuota } from "./exploration";
import { ANIME_COMMON_FACETS, ANIME_MIN_SHARE, ANIME_UNIVERSE_KEY } from "./facets";
import { explorationPicks, isAnimeEntry, mmrPick, pickWithUniverseQuota } from "./rowSelection";
import { pickDaily } from "./seedRotation";
import type { TasteVector } from "./scoring/strategy";
import { REASONS_MAX, toItem } from "./rowItem";
import {
  BECAUSE_FRANCHISE_MAX, SEED_FRANCHISE_MAX, capPerCollection, hasEvidence, inPersonRegister, isFranchiseEntry, isRealKin, worthFilling,
} from "./rowFilters";
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
  forYouMovies: 20,
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
/** La rangée d'exploration pioche après les 40 premiers du classement. */
const EXPLORATION_SKIP_TOP = 40;

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
  // « Films pour vous » juste après « Pour vous » : rangée À THÈME (servie avec `?themes=1`).
  const rows: Array<{ key: string; seedTitle?: string }> = [{ key: "forYou" }, { key: "forYouMovies" }, { key: "inLibrary" }];
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
    const related = capPerCollection(
      pool.entries.filter((e) => isRealKin(e, { key: seedKey, universes: seed.universes, animated: seed.animated }) && (!opts.inLibraryOnly || e.candidate.jellyfinItemId))
    );
    if (related.length < BECAUSE_MIN_ITEMS) continue;
    // Une graine DISTINCTIVE (une série d'auteur) plutôt qu'un carrefour de franchise
    // (un film de super-héros → les Gardiens de la Galaxie) : la part de franchise
    // de ses voisins la fait passer derrière, au-delà de la moitié elle sort du tirage.
    const franchise = related.filter(isFranchiseEntry).length / related.length;
    if (franchise > SEED_FRANCHISE_MAX) continue;
    eligible.push({ key: seedKey, strength: seed.strength * (1 - franchise), seedTitle: seed.title });
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

  // Rangées À THÈME (servies aux clients qui savent les titrer, cf. pageService) :
  // les auteurs qui pèsent le plus dans le goût, s'ils ont de quoi remplir.
  for (const person of themedPeople(pool, opts.inLibraryOnly)) rows.push({ key: `person:${person.key}`, seedTitle: person.name });

  rows.push({ key: "community" }, { key: "exploration" });
  return rows;
}

const THEMED_PEOPLE_MAX = 3;
/** Titres non vus d'une personne pour en faire une rangée. */
const THEMED_PERSON_MIN_ITEMS = 4;

/**
 * Les personnes que le compte ADORE (acteur dans trois titres adorés,
 * réalisateur ou créateur dans deux) et qui ont de quoi remplir une rangée ;
 * à défaut (vieux pool), les auteurs qui pèsent le plus dans les scores.
 */
function themedPeople(pool: PoolPayload, inLibraryOnly: boolean): Array<{ key: string; name: string }> {
  const entries = pool.entries.filter((e) => !inLibraryOnly || e.candidate.jellyfinItemId);
  if (pool.lovedPeople?.length) {
    return pool.lovedPeople
      .filter((p) => entries.filter((e) => inPersonRegister(e, p.key, p)).length >= THEMED_PERSON_MIN_ITEMS)
      .slice(0, THEMED_PEOPLE_MAX)
      .map((p) => ({ key: p.key, name: p.name }));
  }
  const counts = new Map<string, number>();
  for (const e of entries.slice(0, 300)) {
    // L'auteur compte s'il PÈSE dans le score du titre (parmi ses premiers contributeurs).
    for (const c of e.breakdown.topContributors) {
      if (c.contribution > 0 && c.key.startsWith("director:") && pool.labels[c.key]) counts.set(c.key, (counts.get(c.key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= THEMED_PERSON_MIN_ITEMS)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, THEMED_PEOPLE_MAX)
    .map(([key]) => ({ key, name: pool.labels[key] }));
}

/** Rangée d'une personne (« Avec {acteur} », « De {créateur} ») : son `why` en titre, rôle compris. */
function buildPersonRow(pool: PoolPayload, rowKey: string, eligible: PoolEntry[], opts: RowBuildOptions): BuiltRow | null {
  const facet = rowKey.slice("person:".length);
  const loved = pool.lovedPeople?.find((p) => p.key === facet);
  const name = loved?.name ?? pool.labels[facet];
  if (!name) return null;
  const related = capPerCollection(eligible.filter((e) => inPersonRegister(e, facet, loved)), opts.profile.facets);
  if (related.length < THEMED_PERSON_MIN_ITEMS) return null;
  const items = mmrPick(related, BECAUSE_SIZE, opts.lambda).map((e) => toItem(e, pool.labels, opts.providerRefOf, pool.lovedPeople));
  const role = loved?.role ?? (facet.startsWith("actor:") ? "actor" : "director");
  return {
    key: rowKey,
    seedTitle: name,
    why: { kind: "person", person: { id: Number(facet.slice(facet.indexOf(":") + 1)), name }, role },
    generatedAt: pool.generatedAt,
    items,
  };
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
      (!opts.inLibraryOnly || e.candidate.jellyfinItemId) &&
      hasEvidence(e)
  );
  // Part d'animé à la génération : quota des rangées mixtes, rangée dédiée.
  const share = pool.animeShare ?? 0;
  const exploReason: RecoReason = { kind: "exploration" };
  const done = (items: PoolEntry[], seedTitle?: string, exploration = false): BuiltRow => ({
    key: rowKey,
    seedTitle,
    generatedAt: pool.generatedAt,
    items: items.map((e) => {
      const item = toItem(e, pool.labels, opts.providerRefOf, pool.lovedPeople);
      if (exploration) {
        item.exploration = true;
        item.reasons = [exploReason, ...item.reasons].slice(0, REASONS_MAX);
        item.why = [{ kind: "exploration" as const }, ...(item.why ?? [])].slice(0, 3);
      }
      return item;
    }),
  });

  if (rowKey === "forYou") {
    const size = ROW_SIZES.forYou;
    const quota = Math.round(size * explorationQuota(opts.lambda * 100));
    const main = pickWithUniverseQuota(capPerCollection(eligible, opts.profile.facets), size - quota, opts.lambda, share);
    const mainKeys = new Set(main.map((e) => e.candidate.key));
    const explo = explorationPicks(eligible, opts.profile, quota, mainKeys);
    const row = done(main);
    for (const e of explo) {
      const item = toItem(e, pool.labels, opts.providerRefOf, pool.lovedPeople);
      item.exploration = true;
      item.reasons = [exploReason, ...item.reasons].slice(0, REASONS_MAX);
      item.why = [{ kind: "exploration" as const }, ...(item.why ?? [])].slice(0, 3);
      row.items.push(item);
    }
    return row;
  }

  if (rowKey === "forYouMovies") {
    // Les meilleurs FILMS pour le compte, variés (une saga n'y entre que deux fois).
    const movies = capPerCollection(eligible.filter((e) => e.candidate.mediaType === "movie" && worthFilling(e)), opts.profile.facets);
    return movies.length < BECAUSE_MIN_ITEMS ? null : done(mmrPick(movies, ROW_SIZES.forYouMovies, opts.lambda));
  }

  if (rowKey === "inLibrary") {
    const inLibrary = capPerCollection(eligible.filter((e) => e.candidate.jellyfinItemId && worthFilling(e)), opts.profile.facets);
    return done(pickWithUniverseQuota(inLibrary, ROW_SIZES.inLibrary, opts.lambda, share));
  }

  if (rowKey === "discover") {
    if (!opts.vigieAvailable) return null;
    const outside = capPerCollection(eligible.filter((e) => !e.candidate.jellyfinItemId && worthFilling(e)), opts.profile.facets);
    return done(pickWithUniverseQuota(outside, ROW_SIZES.discover, opts.lambda, share));
  }

  if (rowKey === "anime") {
    const related = capPerCollection(eligible.filter((e) => isAnimeEntry(e) && worthFilling(e)), opts.profile.facets);
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
    // Ses VRAIS parents seulement (cf. isRealKin), deux titres d'une saga au plus.
    const related = capPerCollection(eligible.filter((e) => isRealKin(e, { key: seedKey, universes: seed.universes, animated: seed.animated })), opts.profile.facets);
    if (related.length < BECAUSE_MIN_ITEMS) return null;
    const seedReason: RecoReason = { kind: "seed", seedTitle: seed.title };
    // Pas de remplissage d'une même franchise : trois titres au plus.
    let franchiseLeft = BECAUSE_FRANCHISE_MAX;
    const varied = related.filter((e) => !isFranchiseEntry(e) || franchiseLeft-- > 0);
    if (varied.length < BECAUSE_MIN_ITEMS) return null;
    const row = done(mmrPick(varied, BECAUSE_SIZE, opts.lambda), seed.title);
    // La graine de la rangée remplace le titre aimé le plus proche : deux
    // « Parce que vous avez aimé » à la suite se contrediraient.
    for (const item of row.items) {
      item.reasons = [seedReason, ...item.reasons.filter((r) => r.kind !== "seed")].slice(0, REASONS_MAX);
    }
    return row;
  }

  if (rowKey.startsWith("withActor:")) {
    const personId = Number(rowKey.slice("withActor:".length));
    if (!Number.isFinite(personId)) return null;
    const person = pool.people?.find((p) => p.personId === personId);
    const related = capPerCollection(eligible.filter((e) => e.candidate.personKey === personId), opts.profile.facets);
    if (related.length < BECAUSE_MIN_ITEMS) return null;
    const actorReason: RecoReason = { kind: "facet", key: `actor:${personId}`, label: person?.name };
    const row = done(mmrPick(related, BECAUSE_SIZE, opts.lambda), person?.name);
    for (const item of row.items) {
      item.reasons = [actorReason, ...item.reasons].slice(0, REASONS_MAX);
    }
    return row;
  }

  if (rowKey.startsWith("person:")) return buildPersonRow(pool, rowKey, eligible, opts);

  if (rowKey === "exploration") {
    // Hors de la tête du classement : ces titres-là, « Pour vous » et « Dans
    // votre bibliothèque » les montrent déjà.
    const head = new Set(eligible.slice(0, EXPLORATION_SKIP_TOP).map((e) => e.candidate.key));
    return done(explorationPicks(capPerCollection(eligible, opts.profile.facets), opts.profile, ROW_SIZES.exploration, head), undefined, true);
  }

  return null;
}
