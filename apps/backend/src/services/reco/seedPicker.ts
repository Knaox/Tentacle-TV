import type { Anchor } from "./anchors";
import type { SeedRef } from "./candidates/tmdbSource";
import { dailyTieBreak, pickDaily, utcDayStamp } from "./seedRotation";
import type { FacetsOf } from "./tasteModel";

/**
 * Les GRAINES d'un compte (titres dont on suit les recommandations TMDB et
 * les rangées « Parce que vous avez aimé ») choisies parmi ses ancres :
 * - au prorata du NOMBRE de titres de chaque type — aux heures, un compte à
 *   cent cinquante films et deux mille épisodes n'avait que huit graines de
 *   films sur trente ;
 * - les goûts RÉCENTS d'abord, à force égale ; puis les plus regardés, puis
 *   les notés — jamais l'identifiant TMDB, arbitraire et figé ;
 * - diversifiées : cinq Spider-Man ne font qu'une graine, les autres places
 *   vont à d'autres goûts ;
 * - qui TOURNENT : les plus fortes gardent leur place, le reste se tire
 *   chaque jour (compte, jour UTC) dans un vivier deux fois plus large.
 */
export const SEEDS_MAX = 30;
/** Part minimale / maximale d'un type parmi les graines. */
const TYPE_SHARE_MIN = 0.25;
const TYPE_SHARE_MAX = 0.75;
/** Au-delà de cette ressemblance (Jaccard des facettes), deux graines font doublon. */
const SEED_REDUNDANCY = 0.45;
const RECENT_BOOST_DAYS = 90;
const RECENT_BOOST = 1.25;
/** Places tenues par le rang : les plus fortes restent majoritaires. */
const CORE_SHARE = 0.6;
/** Vivier du tirage : tant de fois les places de chaque type. */
const POOL_FACTOR = 2;

interface Scored {
  key: string;
  anchor: Anchor;
  strength: number;
  tie: number;
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const k of a) if (b.has(k)) inter++;
  return inter / (a.size + b.size - inter);
}

const lastAtOf = (a: Anchor) => (a.lastAt ? Date.parse(a.lastAt) || 0 : 0);

/** Force, puis récence, heures, note — et enfin un départage du jour, jamais l'id TMDB. */
function compareScored(x: Scored, y: Scored): number {
  return (
    y.strength - x.strength ||
    lastAtOf(y.anchor) - lastAtOf(x.anchor) ||
    y.anchor.hours - x.anchor.hours ||
    Number(y.anchor.kinds.includes("rating")) - Number(x.anchor.kinds.includes("rating")) ||
    x.tie - y.tie
  );
}

export function pickSeeds(
  anchors: readonly Anchor[],
  facetsOf: FacetsOf,
  opts: { now: number; userId: string; max?: number; dayStamp?: string }
): SeedRef[] {
  const max = opts.max ?? SEEDS_MAX;
  const day = opts.dayStamp ?? utcDayStamp(new Date(opts.now));
  const scored: Scored[] = anchors
    // Une ancre seulement listée ne vient que d'un profil d'avant la v5.
    .filter((a) => a.weight > 0 && a.tmdbId > 0 && !(a.kinds.length === 1 && a.kinds[0] === "watchlist"))
    .map((a) => {
      const age = a.lastAt ? (opts.now - Date.parse(a.lastAt)) / 86_400_000 : Infinity;
      return {
        key: a.key,
        anchor: a,
        strength: a.weight * (age <= RECENT_BOOST_DAYS ? RECENT_BOOST : 1),
        tie: dailyTieBreak(opts.userId, a.key, day),
      };
    })
    .sort(compareScored);

  // Le quota suit le NOMBRE de titres de chaque type.
  const count = { movie: 0, tv: 0 };
  for (const s of scored) count[s.anchor.mediaType]++;
  const total = count.movie + count.tv;
  const tvShare = total > 0 ? Math.min(TYPE_SHARE_MAX, Math.max(TYPE_SHARE_MIN, count.tv / total)) : 0.5;

  // Par type, les graines non redondantes dans l'ordre (le doublon ne se juge
  // qu'entre titres d'un même type).
  const distinct = { movie: [] as Scored[], tv: [] as Scored[] };
  const facetKeys = new Map<string, Set<string>>();
  for (const s of scored) {
    const keys = new Set((facetsOf(s.anchor) ?? []).map((f) => f.key));
    const list = distinct[s.anchor.mediaType];
    if (list.some((p) => jaccard(facetKeys.get(p.key)!, keys) >= SEED_REDUNDANCY)) continue;
    facetKeys.set(s.key, keys);
    list.push(s);
  }

  // Les places laissées vides par un type trop pauvre reviennent à l'autre.
  let tv = Math.min(distinct.tv.length, Math.round(max * tvShare));
  const movie = Math.min(distinct.movie.length, max - tv);
  tv = Math.min(distinct.tv.length, max - movie);

  const choose = (list: Scored[], n: number, type: string): Scored[] => {
    const core = Math.ceil(n * CORE_SHARE);
    const drawn = pickDaily(list.slice(core, n * POOL_FACTOR), `${opts.userId}:seeds:${type}`, n - core, day);
    return [...list.slice(0, core), ...drawn];
  };
  return [...choose(distinct.movie, movie, "movie"), ...choose(distinct.tv, tv, "tv")]
    .sort(compareScored)
    .map((p) => ({
      mediaType: p.anchor.mediaType,
      tmdbId: p.anchor.tmdbId,
      title: p.anchor.title,
      strength: Math.round(p.strength * 1000) / 1000,
    }));
}
