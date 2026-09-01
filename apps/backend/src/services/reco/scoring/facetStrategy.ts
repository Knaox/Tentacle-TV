import type { Candidate, ScoreBreakdown, ScoringStrategy, TasteVector } from "./strategy";
import { freshnessScore, popularityPenalty, qualityScore01 } from "./bayes";

// Pondération de la combinaison finale :
// score = similarité×REL + qualité×QUAL + récence×FRESH − pénalité_popularité.
export const WEIGHT_RELEVANCE = 0.6;
export const WEIGHT_QUALITY = 0.25;
export const WEIGHT_FRESHNESS = 0.15;

const TOP_CONTRIBUTORS = 5;

/**
 * V1 du classement : cosinus entre le vecteur de goût (IDF déjà intégré à la
 * construction du profil) et le vecteur de facettes du candidat (IDF appliqué
 * ici, par symétrie). Le cosinus vit dans [-1, 1] ; la similarité exposée est
 * (cos+1)/2 — 0,5 = neutre, au-dessus = affinité, en dessous = rejet.
 */
export class FacetScoringStrategy implements ScoringStrategy {
  readonly id = "facet-cosine-v1";

  private readonly idfFor: (key: string) => number;
  private readonly nowYear: number;

  constructor(idfFor: (key: string) => number, nowYear = new Date().getFullYear()) {
    this.idfFor = idfFor;
    this.nowYear = nowYear;
  }

  score(profile: TasteVector, candidate: Candidate): ScoreBreakdown {
    const contributions: Array<{ key: string; contribution: number }> = [];
    let dot = 0;
    let candNormSq = 0;

    for (const facet of candidate.facets) {
      const candWeight = facet.mult * this.idfFor(facet.key);
      candNormSq += candWeight * candWeight;
      const profWeight = profile.facets[facet.key];
      if (profWeight) {
        const contribution = profWeight * candWeight;
        dot += contribution;
        contributions.push({ key: facet.key, contribution });
      }
    }

    let profNormSq = 0;
    for (const w of Object.values(profile.facets)) profNormSq += w * w;

    const denom = Math.sqrt(profNormSq) * Math.sqrt(candNormSq);
    const cosine = denom > 0 ? dot / denom : 0;
    const similarity = (cosine + 1) / 2;

    const quality = qualityScore01(candidate.voteAverage, candidate.voteCount);
    const freshness = freshnessScore(candidate.year, this.nowYear);
    const penalty = popularityPenalty(candidate.popularity);

    contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

    return {
      total:
        similarity * WEIGHT_RELEVANCE +
        quality * WEIGHT_QUALITY +
        freshness * WEIGHT_FRESHNESS -
        penalty,
      similarity,
      quality,
      freshness,
      popularityPenalty: penalty,
      topContributors: contributions.slice(0, TOP_CONTRIBUTORS),
    };
  }
}
