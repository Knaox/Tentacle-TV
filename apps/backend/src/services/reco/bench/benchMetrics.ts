import type { PersonaUniverse } from "./benchPersona";

/**
 * Les MESURES du banc de recommandation — pures, sur des listes déjà classées.
 * Chaque mesure dit une chose et une seule ; le rapport les met côte à côte.
 */

/** Ce qu'on sait d'un titre recommandé pour le juger. */
export interface JudgedTitle {
  key: string;
  title: string;
  voteCount: number | null;
  facetKeys: readonly string[];
  universes: readonly PersonaUniverse[];
}

/** Rappel@k : part des titres cachés retrouvés dans les k premiers (rang 0 = premier ; null = absent). */
export function recallAtK(ranks: ReadonlyArray<number | null>, k: number): number {
  if (ranks.length === 0) return 0;
  return ranks.filter((r) => r !== null && r < k).length / ranks.length;
}

/** NDCG@k d'un seul titre pertinent par essai : 1/log2(rang+2) dans les k premiers, 0 sinon ; moyenne. */
export function ndcgAtK(ranks: ReadonlyArray<number | null>, k: number): number {
  if (ranks.length === 0) return 0;
  const gains = ranks.map((r) => (r !== null && r < k ? 1 / Math.log2(r + 2) : 0));
  return gains.reduce((s, g) => s + g, 0) / ranks.length;
}

export interface IntrusionResult {
  rate: number;
  intruders: Array<{ key: string; title: string; why: string }>;
}

/** Part des titres qui sont des intrus : listés « à éviter », ou d'un univers que le compte ne regarde jamais. */
export function intrusions(
  items: readonly JudgedTitle[],
  avoid: ReadonlySet<string>,
  avoidUniverses: readonly PersonaUniverse[]
): IntrusionResult {
  const intruders: IntrusionResult["intruders"] = [];
  for (const item of items) {
    if (avoid.has(item.key)) {
      intruders.push({ key: item.key, title: item.title, why: "à éviter" });
      continue;
    }
    const universe = item.universes.find((u) => avoidUniverses.includes(u));
    if (universe) intruders.push({ key: item.key, title: item.title, why: universe });
  }
  return { rate: items.length ? intruders.length / items.length : 0, intruders };
}

/** Bornes des classes de notoriété, en log10(1 + votes TMDB). */
const POPULARITY_EDGES = [2, 2.5, 3, 3.5, 4, 4.5];

export function popularityBin(voteCount: number | null): number {
  const v = Math.log10(1 + Math.max(0, voteCount ?? 0));
  let bin = 0;
  while (bin < POPULARITY_EDGES.length && v >= POPULARITY_EDGES[bin]) bin++;
  return bin;
}

function histogram(votes: ReadonlyArray<number | null>): number[] {
  const h = new Array(POPULARITY_EDGES.length + 1).fill(0) as number[];
  for (const v of votes) h[popularityBin(v)]++;
  const total = votes.length || 1;
  return h.map((n) => n / total);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Divergence de Jensen-Shannon (base 2, 0..1) entre deux histogrammes normalisés. */
export function jensenShannon(p: readonly number[], q: readonly number[]): number {
  const kl = (a: readonly number[], b: readonly number[]) =>
    a.reduce((s, ai, i) => (ai > 0 && b[i] > 0 ? s + ai * Math.log2(ai / b[i]) : s), 0);
  const m = p.map((pi, i) => (pi + q[i]) / 2);
  return Math.max(0, Math.min(1, (kl(p, m) + kl(q, m)) / 2));
}

export interface PopularityCalibration {
  /** Médiane des votes TMDB de l'historique et des recommandations. */
  historyMedianVotes: number;
  recoMedianVotes: number;
  /** 0 = même répartition confidentiel ↔ grand public ; 1 = rien en commun. */
  jsDivergence: number;
}

/** La calibration de popularité : les recommandations ressemblent-elles à ce que le compte regarde ? */
export function popularityCalibration(
  historyVotes: ReadonlyArray<number | null>,
  recoVotes: ReadonlyArray<number | null>
): PopularityCalibration {
  const clean = (votes: ReadonlyArray<number | null>) => votes.map((v) => Math.max(0, v ?? 0));
  return {
    historyMedianVotes: Math.round(median(clean(historyVotes))),
    recoMedianVotes: Math.round(median(clean(recoVotes))),
    jsDivergence: Math.round(jensenShannon(histogram(historyVotes), histogram(recoVotes)) * 1000) / 1000,
  };
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const k of a) if (b.has(k)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Diversité intra-liste : 1 − Jaccard moyen des facettes, deux à deux (1 = rien en commun). */
export function intraListDiversity(items: readonly JudgedTitle[]): number {
  const sets = items.map((i) => new Set(i.facetKeys));
  let sum = 0;
  let pairs = 0;
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      sum += jaccard(sets[i], sets[j]);
      pairs++;
    }
  }
  return pairs ? Math.round((1 - sum / pairs) * 1000) / 1000 : 1;
}

/** Votes d'un titre « connu de tous » : l'échelle de la nouveauté. */
const NOVELTY_SCALE_VOTES = 40_000;

/** Nouveauté : log10(40 000 / (1 + votes)) moyen — 0 pour un titre que tout le monde a vu, ~4,6 pour une curiosité. */
export function novelty(items: readonly JudgedTitle[]): number {
  if (items.length === 0) return 0;
  const sum = items.reduce((s, i) => s + Math.max(0, Math.log10(NOVELTY_SCALE_VOTES / (1 + Math.max(0, i.voteCount ?? 0)))), 0);
  return Math.round((sum / items.length) * 100) / 100;
}

/** Part des titres attendus présents dans la liste. */
export function expectedHitRate(items: readonly JudgedTitle[], expected: ReadonlySet<string>): { rate: number; found: string[] } {
  if (expected.size === 0) return { rate: 0, found: [] };
  const found = items.filter((i) => expected.has(i.key)).map((i) => i.key);
  return { rate: new Set(found).size / expected.size, found };
}

export interface OrderCheck {
  /** La tête de la rangée porte-t-elle la meilleure correspondance de la rangée ? */
  headIsBest: boolean;
  /** Paires voisines où le second s'annonce PLUS haut que le premier. */
  inversions: number;
  /** Le plus grand écart, en points, d'un titre placé devant un titre mieux annoncé. */
  worstGap: number;
}

/** L'ordre visible suit-il la correspondance affichée (décroissante) ? Rangée sans correspondance : rien à dire. */
export function orderCheck(matches: ReadonlyArray<number | undefined>): OrderCheck {
  const values = matches.filter((m): m is number => m !== undefined);
  let inversions = 0;
  let worstGap = 0;
  let lowest = Infinity;
  for (let i = 0; i < values.length; i++) {
    if (i > 0 && values[i] > values[i - 1]) inversions++;
    // Le pire écart : ce titre contre le moins bien annoncé de ceux placés devant lui.
    worstGap = Math.max(worstGap, values[i] - lowest);
    lowest = Math.min(lowest, values[i]);
  }
  const best = Math.max(...values);
  return { headIsBest: values.length === 0 || values[0] === best, inversions, worstGap };
}
