import type { Anchor } from "./anchors";
import type { SeedRef } from "./candidates/tmdbSource";
import type { ConsumptionShares, FacetsOf } from "./tasteModel";

/**
 * Les GRAINES d'un compte (titres dont on suit les recommandations TMDB et
 * les rangées « Parce que vous avez aimé ») choisies parmi ses ancres :
 * - au prorata du temps passé sur chaque type — un compte à 76 % de séries
 *   ne reçoit plus vingt-deux graines de films pour deux de séries ;
 * - les goûts RÉCENTS d'abord, à force égale ;
 * - diversifiées : cinq Spider-Man ne font qu'une graine, les autres places
 *   vont à d'autres goûts.
 */
export const SEEDS_MAX = 30;
/** Part minimale / maximale d'un type parmi les graines. */
const TYPE_SHARE_MIN = 0.25;
const TYPE_SHARE_MAX = 0.75;
/** Au-delà de cette ressemblance (Jaccard des facettes), deux graines font doublon. */
const SEED_REDUNDANCY = 0.45;
const RECENT_BOOST_DAYS = 90;
const RECENT_BOOST = 1.25;

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const k of a) if (b.has(k)) inter++;
  return inter / (a.size + b.size - inter);
}

export function pickSeeds(
  anchors: readonly Anchor[],
  facetsOf: FacetsOf,
  opts: { shares: ConsumptionShares; now: number; max?: number }
): SeedRef[] {
  const max = opts.max ?? SEEDS_MAX;
  const scored = anchors
    .filter((a) => a.weight > 0 && a.tmdbId > 0 && !(a.kinds.length === 1 && a.kinds[0] === "watchlist"))
    .map((a) => {
      const age = a.lastAt ? (opts.now - Date.parse(a.lastAt)) / 86_400_000 : Infinity;
      return { anchor: a, strength: a.weight * (age <= RECENT_BOOST_DAYS ? RECENT_BOOST : 1) };
    })
    .sort((x, y) => y.strength - x.strength || x.anchor.tmdbId - y.anchor.tmdbId);

  const tvShare = Math.min(TYPE_SHARE_MAX, Math.max(TYPE_SHARE_MIN, opts.shares.tv));
  const quota = { tv: Math.round(max * tvShare), movie: max - Math.round(max * tvShare) };
  const picked: Array<{ anchor: Anchor; strength: number; keys: Set<string> }> = [];
  const redundant = (keys: Set<string>, mediaType: string) =>
    picked.some((p) => p.anchor.mediaType === mediaType && jaccard(p.keys, keys) >= SEED_REDUNDANCY);

  // Deux passes : quotas par type d'abord, puis les places laissées vides par
  // un type trop pauvre reviennent à l'autre.
  for (const pass of [0, 1]) {
    for (const s of scored) {
      if (picked.length >= max) break;
      if (picked.some((p) => p.anchor.key === s.anchor.key)) continue;
      const type = s.anchor.mediaType;
      const taken = picked.filter((p) => p.anchor.mediaType === type).length;
      if (pass === 0 && taken >= quota[type]) continue;
      const keys = new Set((facetsOf(s.anchor) ?? []).map((f) => f.key));
      if (redundant(keys, type)) continue;
      picked.push({ ...s, keys });
    }
  }
  return picked
    .sort((x, y) => y.strength - x.strength)
    .map((p) => ({
      mediaType: p.anchor.mediaType,
      tmdbId: p.anchor.tmdbId,
      title: p.anchor.title,
      strength: Math.round(p.strength * 1000) / 1000,
    }));
}
