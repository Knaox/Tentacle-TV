import { bayesianRating, freshnessScore } from "./bayes";
import {
  ANIME_ERA_SPAN, ANIME_STRONG_KIN, BAR_SPAN, DEFAULT_TASTE_WEIGHTS, LOVED_FULL, TOP_ANCHORS, TOP_CONTRIBUTORS,
  familiarityOf, lowEvidence, qualityOf, quantile, refusalShare, refusalTraitsOf, saturate,
} from "./tasteTerms";
import type { TasteWeights } from "./tasteTerms";
import type { Candidate, ScoreBreakdown, ScoringStrategy, TasteVector } from "./strategy";
import type { TasteIndex } from "./tasteIndex";
import { aversionOf, formatAversionOf } from "../aversion";
import type { FormatAversion, UniverseAversion } from "../aversion";
import { calibrationFit } from "../calibration";
import type { AccountCalibration } from "../calibration";
import { REGISTER_MIN_LOVED, registerCount, smoothedRating } from "../lovedTaste";
import type { LovedPerson } from "../lovedTaste";
import { themeAversionOf } from "../themeAversion";
import type { ThemeAversion } from "../themeAversion";

// Les termes purs vivent dans tasteTerms ; ré-exportés pour les importeurs historiques.
export { DEFAULT_TASTE_WEIGHTS, familiarityOf, lowEvidence, qualityOf, quantile } from "./tasteTerms";
export type { TasteWeights } from "./tasteTerms";

export interface TasteStrategyOptions {
  index: TasteIndex;
  idfFor: (key: string) => number;
  nowYear: number;
  /** Part des titres aimés sortis dans les trois dernières années (0..1). */
  recencyAffinity: number;
  /** Ce que le compte regarde (votes, décennies) ; null = trop peu de titres. */
  calibration?: AccountCalibration | null;
  /** La note lissée sous laquelle un titre déçoit CE compte ; null = pas de barre. */
  qualityBar?: number | null;
  /** Facettes des personnes adorées → leurs titres adorés, par genre (leur registre). */
  lovedPeople?: ReadonlyMap<string, Pick<LovedPerson, "key" | "count" | "genres">>;
  /** La barre de l'univers animé (cf. animeFloor) ; absente = pas de barre. */
  animeFloor?: { minVotes: number | null; minYear: number | null } | null;
  weights?: Partial<TasteWeights>;
}

interface Raw {
  positive: number;
  negative: number;
  profile: number;
  seed: number;
  top: Array<{ anchor: number; contribution: number; similarity: number }>;
  contributors: Array<{ key: string; contribution: number }>;
}

export class TasteScoringStrategy implements ScoringStrategy {
  readonly id = "taste-anchors-v4";
  private readonly weights: TasteWeights;
  private scales = { positive: 0, negative: 0, profile: 0, seed: 0 };
  private readonly norms = new WeakMap<Record<string, number>, number>();
  private aversion: UniverseAversion | undefined;
  private themes: ThemeAversion | undefined;
  private formats: FormatAversion | undefined;

  /** L'aversion du compte, apprise sur le panier (part de chaque univers offerte), ses thèmes et ses formats. */
  setAversion(aversion: UniverseAversion, themes?: ThemeAversion, formats?: FormatAversion): void {
    this.aversion = aversion;
    this.themes = themes;
    this.formats = formats;
  }

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
    const pos: Array<{ anchor: number; contribution: number; similarity: number }> = [];
    const neg: number[] = [];
    const traits = refusalTraitsOf(candidate.facets.map((f) => f.key));
    for (const [i, sim] of index.similarities(candidate.facets)) {
      const anchor = index.anchors[i];
      // Le titre lui-même (dans Ma liste, par exemple) ne se recommande pas.
      if (anchor.key === candidate.key || !(sim > 0)) continue;
      const strength = Math.pow(Math.min(1, sim), sharpness);
      if (anchor.weight > 0) pos.push({ anchor: i, contribution: strength * anchor.weight, similarity: Math.min(1, sim) });
      // Un refus pèse par ce qui l'EXPLIQUE (format, époque, saga), pas par le seul genre.
      else neg.push(strength * -anchor.weight * (anchor.traits ? refusalShare(anchor.traits, traits) : 1));
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

  /**
   * L'écart d'un animé à la barre de l'univers (0..1) : moins de votes que les
   * animés que le compte ADORE (pas encore validé par le public, sauf parenté
   * forte), ou d'avant l'époque de ce qu'il en adore (cf. animeFloorOf).
   */
  private animeGap(candidate: Candidate, relevance: number): number {
    const floor = this.opts.animeFloor;
    if (!floor || !candidate.facets.some((f) => f.key === "universe:anime")) return 0;
    const votes = relevance < ANIME_STRONG_KIN && floor.minVotes != null && (candidate.voteCount ?? 0) < floor.minVotes ? 1 : 0;
    // L'époque : graduelle, pleine ANIME_ERA_SPAN ans avant ce qu'il adore — même un proche parent n'y échappe pas.
    const era = floor.minYear != null && candidate.year != null ? Math.min(1, Math.max(0, (floor.minYear - candidate.year) / ANIME_ERA_SPAN)) : 0;
    return Math.max(votes, era);
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
    const cal = this.opts.calibration;
    const fit = cal ? calibrationFit(cal, candidate.voteCount, candidate.year) : familiarityOf(candidate.voteCount);
    const keys = candidate.facets.map((f) => f.key);
    const aversion = aversionOf(keys, this.aversion);
    // Un FORMAT refusé (feuilletons-fleuves) : appris des refus seuls, cf. formatAversion.
    const format = formatAversionOf(keys, this.formats);
    // Un thème évité ne condamne qu'un titre que le public n'a pas encore validé
    // (peu de votes) : l'isekai d'une saison, pas les classiques du genre.
    const themeAversion = themeAversionOf(candidate.facets.map((f) => f.key), this.themes) * lowEvidence(candidate.voteCount);
    const rating = smoothedRating(candidate.voteAverage, candidate.voteCount);
    const bar = this.opts.qualityBar;
    const belowBar = bar != null && rating != null ? Math.min(1, Math.max(0, (bar - rating) / BAR_SPAN)) : 0;
    // Un animé sous la barre de SON univers (votes, époque) : cf. animeGap.
    const animeGap = this.animeGap(candidate, relevance);
    // Une personne adorée compte dans SON registre seulement (cf. registerCount).
    let lovedCount = 0;
    for (const f of candidate.facets) {
      const person = this.opts.lovedPeople?.get(f.key);
      if (person) lovedCount = Math.max(lovedCount, registerCount(person, keys));
    }
    const loved = lovedCount >= REGISTER_MIN_LOVED ? Math.min(1, lovedCount / LOVED_FULL) : 0;
    const total =
      w.relevance * relevance +
      w.seed * seed +
      w.profile * affinity +
      w.quality * quality +
      w.freshness * this.opts.recencyAffinity * freshness +
      (cal ? w.calibration : w.familiarity) * fit -
      w.negative * negative -
      w.aversion * Math.max(aversion, format) -
      w.themeAversion * themeAversion -
      w.qualityBar * Math.max(belowBar, animeGap) +
      w.lovedPeople * loved;

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
      calibration: fit,
      aversion: Math.max(aversion, themeAversion, format),
      qualityGap: Math.max(belowBar, animeGap),
      topAnchors: r.top.slice(0, TOP_ANCHORS).map((t) => ({
        key: anchors[t.anchor].key,
        title: anchors[t.anchor].title,
        contribution: t.contribution,
        similarity: Math.round(t.similarity * 1000) / 1000,
        liked: anchors[t.anchor].liked !== false,
        loved: anchors[t.anchor].loved === true,
      })),
    };
  }
}
