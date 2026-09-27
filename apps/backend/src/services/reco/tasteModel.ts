import type { Anchor } from "./anchors";
import type { FacetEntry } from "./facets";
import { TasteIndex } from "./scoring/tasteIndex";

/**
 * Le modèle de goût d'un compte, dérivé de ses ancres : profil moyen
 * ÉQUILIBRÉ films/séries, index des ancres, appétit pour les nouveautés, part
 * d'animé. Pur : l'appelant fournit les facettes de chaque ancre (cache TMDB,
 * repli Jellyfin).
 */
export type FacetsOf = (anchor: Anchor) => readonly FacetEntry[] | null;

export interface ConsumptionShares {
  movie: number;
  tv: number;
}

/** Heures prêtées à un film vu dont la durée est inconnue. */
const DEFAULT_MOVIE_HOURS = 2;
/** Chaque type garde au moins cette part du profil moyen : un compte qui
 *  regarde surtout des séries n'efface pas pour autant ses films. */
const SHARE_FLOOR = 0.2;

function hoursOf(anchor: Anchor): number {
  if (anchor.hours > 0) return anchor.hours;
  return anchor.mediaType === "movie" ? DEFAULT_MOVIE_HOURS : 0;
}

/**
 * Part du TEMPS de visionnage par type, sur les ancres de consommation
 * positives. Chez un compte réel : 76 % du temps sur des séries — et un
 * profil fait à 76 % de films, parce qu'on note et met en favori des films.
 */
export function consumptionShares(anchors: readonly Anchor[]): ConsumptionShares {
  let movie = 0;
  let tv = 0;
  for (const a of anchors) {
    if (!a.consumption || a.weight <= 0) continue;
    if (a.mediaType === "movie") movie += hoursOf(a);
    else tv += hoursOf(a);
  }
  const total = movie + tv;
  if (total <= 0) return { movie: 0.5, tv: 0.5 };
  const m = Math.min(1 - SHARE_FLOOR, Math.max(SHARE_FLOOR, movie / total));
  return { movie: m, tv: 1 - m };
}

/**
 * Profil moyen : Σ poids × facettes × IDF, calculé À PART pour les films et
 * pour les séries, chaque moitié normalisée puis pondérée par sa part de
 * temps de visionnage — la norme d'ensemble est conservée (les seuils du
 * moteur, la nouveauté de l'exploration, lisent des poids absolus).
 */
export function buildCentroid(
  anchors: readonly Anchor[],
  facetsOf: FacetsOf,
  idfFor: (key: string) => number,
  shares: ConsumptionShares
): Record<string, number> {
  const parts = { movie: new Map<string, number>(), tv: new Map<string, number>() };
  for (const a of anchors) {
    const facets = facetsOf(a);
    if (!facets || facets.length === 0) continue;
    const vec = parts[a.mediaType];
    for (const f of facets) {
      vec.set(f.key, (vec.get(f.key) ?? 0) + a.weight * f.mult * idfFor(f.key));
    }
  }
  const normOf = (m: Map<string, number>) => Math.sqrt([...m.values()].reduce((s, v) => s + v * v, 0));
  const nm = normOf(parts.movie);
  const nt = normOf(parts.tv);
  const scale = nm + nt;
  const out: Record<string, number> = {};
  const addPart = (m: Map<string, number>, norm: number, share: number) => {
    if (norm <= 0) return;
    for (const [k, v] of m) out[k] = (out[k] ?? 0) + (v / norm) * share * scale;
  };
  // Un type absent cède toute la place à l'autre.
  const movieShare = nt > 0 ? (nm > 0 ? shares.movie : 1) : 1;
  addPart(parts.movie, nm, movieShare);
  addPart(parts.tv, nt, nm > 0 ? shares.tv : 1);
  return out;
}

/** Index des ancres pour le classement (cf. TasteScoringStrategy). */
export function buildTasteIndex(
  anchors: readonly Anchor[],
  facetsOf: FacetsOf,
  idfFor: (key: string) => number
): TasteIndex {
  const index = new TasteIndex(idfFor);
  for (const a of anchors) {
    const facets = facetsOf(a);
    if (!facets || facets.length === 0) continue;
    index.add({ key: a.key, title: a.title, weight: a.weight, mediaType: a.mediaType }, facets);
  }
  return index;
}

/** Nouveautés : années glissantes comptées comme « récentes ». */
const RECENT_YEARS = 3;

/**
 * Appétit du compte pour les nouveautés : part (en poids) de ses titres aimés
 * sortis dans les trois dernières années. Un amateur de classiques ne voit
 * plus les sorties du mois passer devant ses goûts.
 */
export function recencyAffinity(
  anchors: readonly Anchor[],
  yearOf: (anchor: Anchor) => number | null,
  nowYear: number
): number {
  let recent = 0;
  let total = 0;
  for (const a of anchors) {
    if (a.weight <= 0) continue;
    const year = yearOf(a);
    if (year == null) continue;
    total += a.weight;
    if (nowYear - year < RECENT_YEARS) recent += a.weight;
  }
  return total > 0 ? recent / total : 0;
}

/**
 * Part d'un univers (l'animé) dans le TEMPS de visionnage : Σ heures des
 * ancres de consommation positives qui le portent / Σ heures.
 */
export function universeShareOf(anchors: readonly Anchor[], inUniverse: (anchor: Anchor) => boolean): number {
  let total = 0;
  let inside = 0;
  for (const a of anchors) {
    if (!a.consumption || a.weight <= 0) continue;
    const h = hoursOf(a);
    total += h;
    if (inUniverse(a)) inside += h;
  }
  return total > 0 ? inside / total : 0;
}
