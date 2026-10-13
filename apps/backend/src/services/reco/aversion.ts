import type { Anchor } from "./anchors";
import type { Candidate } from "./scoring/strategy";
import { FORMAT_LONG_RUNNING, UNIVERSES, UNIVERSE_FACET, universesOfFacets } from "./universes";
import type { TitleUniverse } from "./universes";

/**
 * L'AVERSION apprise par l'exposition : un univers (animé, animation familiale,
 * franchise) très présent dans la bibliothèque du compte mais qu'il ne regarde
 * jamais est un univers qu'il ÉVITE. Lift = part dans ce qu'il regarde / part
 * dans ce qu'on lui offre, lissé ; sous 1, la pénalité monte. Un refus dans un
 * univers compte contre lui. Rien d'imposé : un fan d'animés n'a aucune
 * aversion pour l'animé, une famille aucune pour Pixar.
 */
export type UniverseAversion = Record<TitleUniverse, number>;

/** Lissage des parts : une exposition minuscule ne fait pas un lift énorme. */
const SMOOTHING = 0.03;
/** Heures retirées à un univers par titre refusé. */
const REFUSAL_HOURS = 3;
/** Titres regardés pour une confiance pleine : trois titres ne font pas une aversion ferme. */
const FULL_CONFIDENCE_ANCHORS = 12;
const DEFAULT_MOVIE_HOURS = 2;

export const NO_AVERSION: UniverseAversion = { anime: 0, kidsAnimation: 0, franchise: 0 };

/** Pur : la pénalité de chaque univers pour CE compte (0 = aucune, 1 = jamais regardé, très offert). */
export function universeAversion(
  anchors: readonly Anchor[],
  facetsOf: (anchor: Anchor) => readonly { key: string }[] | null,
  exposure: Readonly<Record<TitleUniverse, number>>
): UniverseAversion {
  let total = 0;
  let consumed = 0;
  const hours: Record<TitleUniverse, number> = { anime: 0, kidsAnimation: 0, franchise: 0 };
  for (const a of anchors) {
    const universes = universesOfFacets((facetsOf(a) ?? []).map((f) => f.key));
    if (a.weight < 0 && a.kinds.includes("dismissed")) {
      for (const u of universes) hours[u] -= REFUSAL_HOURS;
      continue;
    }
    if (!a.consumption || a.weight <= 0) continue;
    const h = a.hours > 0 ? a.hours : a.mediaType === "movie" ? DEFAULT_MOVIE_HOURS : 1;
    total += h;
    consumed++;
    for (const u of universes) hours[u] += h;
  }
  const confidence = Math.min(1, consumed / FULL_CONFIDENCE_ANCHORS);
  const out: UniverseAversion = { ...NO_AVERSION };
  if (total <= 0) return out;
  for (const u of UNIVERSES) {
    const share = Math.max(0, hours[u]) / total;
    const lift = (share + SMOOTHING) / ((exposure[u] ?? 0) + SMOOTHING);
    out[u] = Math.round(confidence * Math.max(0, Math.min(1, 1 - lift)) * 1000) / 1000;
  }
  return out;
}

/** Pur : la part de chaque univers dans ce que la BIBLIOTHÈQUE offre (candidats rattachés). */
export function libraryExposure(candidates: readonly Candidate[]): Record<TitleUniverse, number> {
  const inLibrary = candidates.filter((c) => !!c.jellyfinItemId);
  const out: Record<TitleUniverse, number> = { anime: 0, kidsAnimation: 0, franchise: 0 };
  if (inLibrary.length === 0) return out;
  for (const c of inLibrary) {
    const keys = new Set(c.facets.map((f) => f.key));
    for (const u of UNIVERSES) if (keys.has(UNIVERSE_FACET[u])) out[u]++;
  }
  for (const u of UNIVERSES) out[u] = out[u] / inLibrary.length;
  return out;
}

/** Les univers qui sont des MONDES à regarder ; la franchise n'est qu'une étiquette de production. */
const WORLDS: readonly TitleUniverse[] = ["anime", "kidsAnimation"];

/**
 * La pénalité d'un titre : celle de son MONDE le plus regardé (un Ghibli familial
 * chez une famille : 0) ; la franchise ne compte que hors de tout monde — un
 * animé « tiré d'un comic » n'échappe pas à l'aversion d'un fan de Marvel pour l'animé.
 */
export function aversionOf(facetKeys: Iterable<string>, aversion: Readonly<UniverseAversion> | undefined): number {
  if (!aversion) return 0;
  const universes = universesOfFacets(facetKeys);
  if (universes.length === 0) return 0;
  const worlds = universes.filter((u) => WORLDS.includes(u));
  return Math.min(...(worlds.length ? worlds : universes).map((u) => aversion[u] ?? 0));
}

/** Refus d'un même format pour en faire une aversion : un refus isolé n'en fait pas une. */
const FORMAT_MIN_REFUSALS = 2;
/** Les formats appris des refus (cf. universes, FORMAT_LONG_RUNNING). */
export const FORMAT_FACETS: readonly string[] = [FORMAT_LONG_RUNNING];
export type FormatAversion = Record<string, number>;

/**
 * Pur : l'aversion de FORMAT, apprise des seuls refus — quatre feuilletons-fleuves
 * refusés contre deux adorés : 4 / (4 + 2 + 1) ≈ 0,57. Sans refus, rien : le
 * format n'est jamais un défaut en soi, et ce qu'il adore dans ce format le
 * retient (qui adore un fleuve et en refuse un autre n'en a qu'une partielle).
 */
export function formatAversion(
  anchors: readonly Anchor[],
  facetsOf: (anchor: Anchor) => readonly { key: string }[] | null
): FormatAversion {
  const out: FormatAversion = {};
  for (const format of FORMAT_FACETS) {
    let refused = 0;
    let liked = 0;
    for (const a of anchors) {
      if (!(facetsOf(a) ?? []).some((f) => f.key === format)) continue;
      if (a.weight < 0 && a.kinds.includes("dismissed")) refused++;
      else if (a.consumption && a.weight > 0) liked++;
    }
    out[format] = refused >= FORMAT_MIN_REFUSALS ? Math.round((refused / (refused + liked + 1)) * 1000) / 1000 : 0;
  }
  return out;
}

/** La pénalité de format d'un titre : celle de son format le plus évité. */
export function formatAversionOf(facetKeys: Iterable<string>, aversion: Readonly<FormatAversion> | undefined): number {
  if (!aversion) return 0;
  let max = 0;
  for (const key of facetKeys) max = Math.max(max, aversion[key] ?? 0);
  return max;
}
