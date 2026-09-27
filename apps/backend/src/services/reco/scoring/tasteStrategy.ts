import { bayesianRating, freshnessScore } from "./bayes";
import type { Candidate, ScoreBreakdown, ScoringStrategy, TasteVector } from "./strategy";
import type { TasteIndex } from "./tasteIndex";

/**
 * Pondération du classement à ancres. Chaque composante est d'abord ramenée
 * dans 0..1 par une saturation calibrée sur le panier du compte (cf.
 * calibrate) : les poids disent enfin ce qu'ils pèsent. L'ancienne formule
 * gardait la similarité dans 0,50..0,56 — la récence et la note TMDB, les
 * mêmes pour tous, décidaient seules du classement.
 */
export interface TasteWeights {
  /** Proximité aux titres aimés, un par un. */
  relevance: number;
  /** Soutien des graines (recommandations TMDB cumulées). */
  seed: number;
  /** Affinité au profil moyen (langue, époque, genres dominants). */
  profile: number;
  quality: number;
  /** Récence, modulée par l'appétit du compte pour les nouveautés. */
  freshness: number;
  /** Ressemblance aux refus et abandons (soustraite). */
  negative: number;
  /** Notoriété (nombre de votes TMDB) : à goût égal, un titre reconnu est un
   *  pari plus sûr qu'une curiosité à trente votes. */
  familiarity: number;
  /** Ancres retenues par candidat : ses plus proches voisins aimés. */
  neighbors: number;
  /** Exposant de la similarité : > 1, une correspondance franche l'emporte
   *  sur dix correspondances vagues. */
  sharpness: number;
}

/** Réglage retenu au banc (titres aimés cachés, 13 comptes) : trois fois plus
 *  de titres aimés retrouvés dans les 30 premiers que l'ancienne formule, et
 *  quatre titres communs sur 50 entre deux comptes au lieu de trente-quatre. */
export const DEFAULT_TASTE_WEIGHTS: Readonly<TasteWeights> = {
  relevance: 0.5,
  seed: 0.2,
  profile: 0.08,
  quality: 0.25,
  freshness: 0.2,
  negative: 0.25,
  familiarity: 0.25,
  neighbors: 5,
  sharpness: 1.5,
};

/** Votes TMDB au-delà desquels un titre est pleinement « reconnu ». */
const FAMILIAR_VOTES = 20_000;

/** Notoriété 0..1 : log du nombre de votes, plein à FAMILIAR_VOTES. */
export function familiarityOf(voteCount: number | null): number {
  const v = Math.max(0, voteCount ?? 0);
  return Math.min(1, Math.log10(1 + v) / Math.log10(1 + FAMILIAR_VOTES));
}

/** Note bayésienne ramenée à 0..1 entre ces bornes : 5,5 = médiocre, 8,2 = excellent. */
const QUALITY_LOW = 5.5;
const QUALITY_HIGH = 8.2;
const TOP_CONTRIBUTORS = 5;
const TOP_ANCHORS = 3;

export interface TasteStrategyOptions {
  index: TasteIndex;
  idfFor: (key: string) => number;
  nowYear: number;
  /** Part des titres aimés sortis dans les trois dernières années (0..1). */
  recencyAffinity: number;
  weights?: Partial<TasteWeights>;
}

interface Raw {
  positive: number;
  negative: number;
  profile: number;
  seed: number;
  top: Array<{ anchor: number; contribution: number }>;
  contributors: Array<{ key: string; contribution: number }>;
}

/** Quantile d'une liste (non triée) ; 0 si vide. */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

/** Saturation douce : 0 → 0, l'échelle → 0,63, deux échelles → 0,86. */
function saturate(value: number, scale: number): number {
  if (!(value > 0) || !(scale > 0)) return 0;
  return 1 - Math.exp(-value / scale);
}

export function qualityOf(voteAverage: number | null, voteCount: number | null): number {
  const wr = bayesianRating(voteAverage, voteCount);
  return Math.min(1, Math.max(0, (wr - QUALITY_LOW) / (QUALITY_HIGH - QUALITY_LOW)));
}

export class TasteScoringStrategy implements ScoringStrategy {
  readonly id = "taste-anchors-v2";
  private readonly weights: TasteWeights;
  private scales = { positive: 0, negative: 0, profile: 0, seed: 0 };
  private readonly norms = new WeakMap<Record<string, number>, number>();

  constructor(private readonly opts: TasteStrategyOptions) {
    this.weights = { ...DEFAULT_TASTE_WEIGHTS, ...opts.weights };
  }

  /**
   * Étalonne les saturations sur le panier du compte (quantile 90 de chaque
   * composante) : sans elle, une composante à grande échelle écraserait les
   * autres. À appeler une fois avant `score`, sur les candidats à classer.
   */
  calibrate(profile: TasteVector, candidates: readonly Candidate[]): void {
    const pos: number[] = [];
    const neg: number[] = [];
    const prof: number[] = [];
    const seed: number[] = [];
    for (const c of candidates) {
      const r = this.raw(profile, c);
      if (r.positive > 0) pos.push(r.positive);
      if (r.negative > 0) neg.push(r.negative);
      if (r.profile > 0) prof.push(r.profile);
      if (r.seed > 0) seed.push(r.seed);
    }
    this.scales = {
      positive: quantile(pos, 0.9),
      negative: quantile(neg, 0.9),
      profile: quantile(prof, 0.9),
      seed: quantile(seed, 0.9),
    };
  }

  private profileNorm(facets: Record<string, number>): number {
    let norm = this.norms.get(facets);
    if (norm === undefined) {
      norm = 0;
      for (const w of Object.values(facets)) norm += w * w;
      norm = Math.sqrt(norm);
      this.norms.set(facets, norm);
    }
    return norm;
  }

  private raw(profile: TasteVector, candidate: Candidate): Raw {
    const { index, idfFor } = this.opts;
    const { neighbors, sharpness } = this.weights;
    const pos: Array<{ anchor: number; contribution: number }> = [];
    const neg: number[] = [];
    for (const [i, sim] of index.similarities(candidate.facets)) {
      const anchor = index.anchors[i];
      // Le titre lui-même (dans Ma liste, par exemple) ne se recommande pas.
      if (anchor.key === candidate.key || !(sim > 0)) continue;
      const strength = Math.pow(Math.min(1, sim), sharpness);
      if (anchor.weight > 0) pos.push({ anchor: i, contribution: strength * anchor.weight });
      else neg.push(strength * -anchor.weight);
    }
    pos.sort((a, b) => b.contribution - a.contribution);
    neg.sort((a, b) => b - a);
    const top = pos.slice(0, neighbors);

    // Affinité au profil moyen : cosinus TF-IDF, et les facettes qui portent.
    const contributors: Array<{ key: string; contribution: number }> = [];
    let dot = 0;
    let candNormSq = 0;
    for (const facet of candidate.facets) {
      const w = facet.mult * idfFor(facet.key);
      candNormSq += w * w;
      const p = profile.facets[facet.key];
      if (p) {
        dot += p * w;
        contributors.push({ key: facet.key, contribution: p * w });
      }
    }
    const denom = this.profileNorm(profile.facets) * Math.sqrt(candNormSq);
    return {
      positive: top.reduce((s, t) => s + t.contribution, 0),
      negative: neg.slice(0, neighbors).reduce((s, v) => s + v, 0),
      profile: denom > 0 ? dot / denom : 0,
      seed: candidate.seedSupport ?? 0,
      top,
      contributors,
    };
  }

  score(profile: TasteVector, candidate: Candidate): ScoreBreakdown {
    const w = this.weights;
    const r = this.raw(profile, candidate);
    const relevance = saturate(r.positive, this.scales.positive);
    const negative = saturate(r.negative, this.scales.negative);
    const affinity = saturate(r.profile, this.scales.profile);
    const seed = saturate(r.seed, this.scales.seed);
    const quality = qualityOf(candidate.voteAverage, candidate.voteCount);
    const freshness = freshnessScore(candidate.year, this.opts.nowYear);
    const total =
      w.relevance * relevance +
      w.seed * seed +
      w.profile * affinity +
      w.quality * quality +
      w.freshness * this.opts.recencyAffinity * freshness +
      w.familiarity * familiarityOf(candidate.voteCount) -
      w.negative * negative;

    r.contributors.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    const { anchors } = this.opts.index;
    return {
      total,
      similarity: relevance,
      // Exposée sur l'échelle historique (note/10) : l'exploration la lit ainsi.
      quality: bayesianRating(candidate.voteAverage, candidate.voteCount) / 10,
      freshness,
      popularityPenalty: 0,
      topContributors: r.contributors.slice(0, TOP_CONTRIBUTORS),
      relevance,
      seedSupport: seed,
      negative,
      topAnchors: r.top.slice(0, TOP_ANCHORS).map((t) => ({
        key: anchors[t.anchor].key,
        title: anchors[t.anchor].title,
        contribution: t.contribution,
        liked: anchors[t.anchor].liked !== false,
      })),
    };
  }
}
