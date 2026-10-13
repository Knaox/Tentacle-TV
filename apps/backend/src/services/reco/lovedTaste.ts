import type { TitleMeta } from "../tmdb/metaCache";
import type { Anchor } from "./anchors";
import { TMDB_GENRE_ANIMATION } from "./universes";

/**
 * Ce que le compte ADORE dit deux choses de plus que ses titres :
 * - ses PERSONNES : un acteur présent dans trois titres adorés, un réalisateur
 *   ou un créateur dans deux, deviennent un goût à part entière (« Avec Ryan
 *   {acteur} », « De {créateur} ») ;
 * - sa BARRE DE QUALITÉ : le niveau de ce qu'il adore. Un compte exigeant ne
 *   reçoit pas de remplissage ; une famille, des blockbusters gardent la leur.
 */
export interface LovedPerson {
  /** Facette du moteur : « actor:30614 », « director:66633 ». */
  key: string;
  id: number;
  name: string;
  role: "actor" | "director" | "creator";
  /** Titres adorés qui la portent. */
  count: number;
  /** Son REGISTRE : titres adorés qui la portent, par genre (« genre:28 » → 3). Absent : vieux pool. */
  genres?: Record<string, number>;
}

/** Titres adorés d'une personne, d'un même genre que le candidat, pour qu'elle compte. */
export const REGISTER_MIN_LOVED = 2;

/**
 * Pur : les titres adorés d'une personne qui partagent un genre avec le titre
 * (son registre) — trois films d'action adorés ne disent rien de son drame romantique.
 */
export function registerCount(person: Pick<LovedPerson, "key" | "count" | "genres">, facetKeys: Iterable<string>): number {
  const keys = [...facetKeys];
  // Un acteur n'a pas de registre dans un film d'animation : il n'y prête que sa voix.
  if (person.key.startsWith("actor:") && keys.includes(`genre:${TMDB_GENRE_ANIMATION}`)) return 0;
  if (!person.genres) return person.count;
  let best = 0;
  for (const key of keys) best = Math.max(best, person.genres[key] ?? 0);
  return best;
}

const ACTOR_MIN_LOVED = 3;
const AUTHOR_MIN_LOVED = 2;
const LOVED_PEOPLE_MAX = 8;
/** Votes du lissage de la barre : sous lui, une note compte moins (série neuve à vingt votes). */
const BAR_PRIOR_VOTES = 200;
const BAR_PRIOR_MEAN = 6.5;
/** La barre : le quart le moins bien noté de ce qu'il adore, un peu en dessous. */
const BAR_QUANTILE = 0.25;
const BAR_MARGIN = 0.3;
const BAR_MIN_LOVED = 5;

function quantile(values: number[], q: number): number {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

export function isLoved(a: Anchor): boolean {
  return (
    a.kinds.some((k) => k === "favorite" || k === "like" || k === "swipe_like" || k === "superlike") ||
    (a.kinds.includes("rating") && a.weight >= 1)
  );
}

/** La note d'un titre lissée vers la moyenne du corpus, à la mesure de ses votes. */
export function smoothedRating(voteAverage: number | null, voteCount: number | null): number | null {
  if (voteAverage == null || !voteCount || voteCount <= 0) return null;
  return (voteCount * voteAverage + BAR_PRIOR_VOTES * BAR_PRIOR_MEAN) / (voteCount + BAR_PRIOR_VOTES);
}

/** Pur : les personnes que le compte adore, des plus présentes aux moins. */
export function lovedPeopleOf(anchors: readonly Anchor[], metaOf: (a: Anchor) => TitleMeta | undefined): LovedPerson[] {
  const tally = new Map<string, LovedPerson & { movies: number; genres: Record<string, number> }>();
  const add = (key: string, id: number, name: string, role: LovedPerson["role"], meta: TitleMeta) => {
    const cur = tally.get(key) ?? { key, id, name, role, count: 0, movies: 0, genres: {} };
    cur.count++;
    if (meta.mediaType === "movie") cur.movies++;
    for (const g of meta.genres) cur.genres[`genre:${g.id}`] = (cur.genres[`genre:${g.id}`] ?? 0) + 1;
    tally.set(key, cur);
  };
  for (const a of anchors) {
    if (!isLoved(a)) continue;
    const meta = metaOf(a);
    if (!meta) continue;
    const movie = meta.mediaType === "movie";
    // Une VOIX d'animation n'est pas un jeu d'acteur : un dessin animé adoré ne fait pas aimer qui y prête sa voix.
    const animation = meta.genres.some((g) => g.id === TMDB_GENRE_ANIMATION);
    if (!animation) for (const p of meta.topCast) if (p.name) add(`actor:${p.id}`, p.id, p.name, "actor", meta);
    for (const p of meta.directors) if (p.name) add(`director:${p.id}`, p.id, p.name, movie ? "director" : "creator", meta);
  }
  return [...tally.values()]
    .filter((p) => p.count >= (p.role === "actor" ? ACTOR_MIN_LOVED : AUTHOR_MIN_LOVED))
    .map(({ movies, ...p }) => ({ ...p, role: p.role === "actor" ? "actor" : movies * 2 >= p.count ? "director" : "creator" }) as LovedPerson)
    .sort((x, y) => y.count - x.count || (x.key < y.key ? -1 : 1))
    .slice(0, LOVED_PEOPLE_MAX);
}

/** Pur : la barre de qualité du compte (note lissée), ou null s'il adore trop peu de titres connus. */
export function qualityBarOf(anchors: readonly Anchor[], metaOf: (a: Anchor) => TitleMeta | undefined): number | null {
  const ratings: number[] = [];
  for (const a of anchors) {
    if (!isLoved(a)) continue;
    const meta = metaOf(a);
    const r = meta ? smoothedRating(meta.voteAverage, meta.voteCount) : null;
    if (r != null) ratings.push(r);
  }
  if (ratings.length < BAR_MIN_LOVED) return null;
  return Math.round((quantile(ratings, BAR_QUANTILE) - BAR_MARGIN) * 100) / 100;
}

/** Animés adorés / regardés exigés pour poser une barre propre à l'univers. */
const ANIME_FLOOR_MIN_LOVED = 3;
/** Le dixième des animés adorés les moins votés fixe le plancher de votes, plafonné :
 *  au-delà de 300 votes, un animé est validé par le public quel que soit le compte. */
const ANIME_FLOOR_QUANTILE = 0.1;
const ANIME_FLOOR_MAX_VOTES = 300;
/** Années de marge sous le plus ancien animé regardé (repli : trop peu d'animés datés). */
const ANIME_ERA_MARGIN = 3;
/** Animés regardés datés pour lire une distribution. */
const ANIME_ERA_MIN_TITLES = 6;
/**
 * L'époque de l'univers : ce quantile des années des animés qu'il regarde et
 * adore — un classique isolé ne la fait pas reculer de vingt ans. Réglé au banc :
 * à 0,2, un fan qui regarde aussi des classiques des années 1990 perdait ceux des années 2000.
 */
const ANIME_ERA_QUANTILE = 0.15;

/**
 * Pur : la barre de l'univers animé d'un compte — les votes du quart le moins
 * voté de ce qu'il ADORE en animé, et l'année de son plus ancien animé regardé
 * (moins trois ans). Un compte qui n'adore pas d'animés n'a pas de barre.
 */
export function animeFloorOf(
  anchors: readonly Anchor[],
  metaOf: (a: Anchor) => TitleMeta | undefined,
  isAnime: (a: Anchor) => boolean
): { minVotes: number | null; minYear: number | null } | null {
  const loved: number[] = [];
  const years: number[] = [];
  for (const a of anchors) {
    if (!isAnime(a) || a.weight <= 0) continue;
    const meta = metaOf(a);
    if (!meta) continue;
    if (a.consumption && meta.year != null) years.push(meta.year);
    if (isLoved(a) && meta.voteCount != null) loved.push(meta.voteCount);
  }
  if (loved.length < ANIME_FLOOR_MIN_LOVED) return null;
  // L'époque suit la DISTRIBUTION de ce qu'il regarde et adore (un titre isolé de
  // vingt ans plus tôt ne rouvre pas son époque) ; trop peu de titres datés : le plus ancien, moins la marge.
  const minYear = years.length >= ANIME_ERA_MIN_TITLES
    ? quantile(years, ANIME_ERA_QUANTILE)
    : years.length ? Math.min(...years) - ANIME_ERA_MARGIN : null;
  return { minVotes: Math.min(ANIME_FLOOR_MAX_VOTES, Math.round(quantile(loved, ANIME_FLOOR_QUANTILE))), minYear };
}

/** Auteurs (créateurs, réalisateurs) interrogés au plus par génération. */
const LOVED_AUTHORS_MAX = 8;

/**
 * Pur : les AUTEURS de ce qu'il adore, dès UN titre (Fargo → Noah Hawley, donc
 * Legion) — séries d'abord (un créateur de série est plus
 * distinctif qu'un réalisateur de blockbuster), puis les plus présents.
 */
export function lovedAuthorsOf(
  anchors: readonly Anchor[],
  metaOf: (a: Anchor) => TitleMeta | undefined
): Array<{ personId: number; name: string }> {
  const tally = new Map<number, { personId: number; name: string; count: number; tv: number }>();
  for (const a of anchors) {
    if (!isLoved(a)) continue;
    const meta = metaOf(a);
    for (const p of meta?.directors ?? []) {
      if (!p.name) continue;
      const cur = tally.get(p.id) ?? { personId: p.id, name: p.name, count: 0, tv: 0 };
      cur.count++;
      if (meta?.mediaType === "tv") cur.tv++;
      tally.set(p.id, cur);
    }
  }
  return [...tally.values()]
    .sort((x, y) => Number(y.tv > 0) - Number(x.tv > 0) || y.count - x.count || x.personId - y.personId)
    .slice(0, LOVED_AUTHORS_MAX)
    .map(({ personId, name }) => ({ personId, name }));
}
