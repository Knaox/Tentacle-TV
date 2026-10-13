import { decadeOf } from "./facets";

/**
 * La CALIBRATION d'un compte : où il se situe entre confidentiel et grand
 * public (votes TMDB), et entre classiques et nouveautés (décennies). Un
 * histogramme lissé de ce qu'il regarde ; un candidat vaut la part de sa classe
 * rapportée à la classe la plus regardée (0..1). Dans les DEUX sens : un fan de
 * blockbusters garde ses blockbusters, un cinéphile ne reçoit pas le canon
 * qu'il a vu ailleurs, un amateur de vieux films reçoit de vieux films.
 */
export interface AccountCalibration {
  popularity: number[];
  era: Map<number, number>;
}

/** Bornes des classes de notoriété, en log10(1 + votes TMDB). */
const POPULARITY_EDGES = [2, 2.5, 3, 3.5, 4, 4.5];
/** Lissage par classe : une classe jamais vue garde une petite chance. */
const POPULARITY_PRIOR = 0.15;
const ERA_PRIOR = 0.1;
/** Moins d'échantillons : aucun avis (une pondération neutre). */
const MIN_SAMPLES = 3;

export function popularityClass(voteCount: number | null): number {
  const v = Math.log10(1 + Math.max(0, voteCount ?? 0));
  let bin = 0;
  while (bin < POPULARITY_EDGES.length && v >= POPULARITY_EDGES[bin]) bin++;
  return bin;
}

/** Pur : l'histogramme d'un compte, depuis ses titres regardés (votes, année, poids). */
export function buildCalibration(samples: ReadonlyArray<{ votes: number | null; year: number | null; weight: number }>): AccountCalibration | null {
  const kept = samples.filter((s) => s.weight > 0);
  if (kept.length < MIN_SAMPLES) return null;
  const popularity = new Array(POPULARITY_EDGES.length + 1).fill(0) as number[];
  const era = new Map<number, number>();
  for (const s of kept) {
    if (s.votes != null) popularity[popularityClass(s.votes)] += s.weight;
    if (s.year != null) era.set(decadeOf(s.year), (era.get(decadeOf(s.year)) ?? 0) + s.weight);
  }
  return { popularity, era };
}

function fitOf(value: number, all: readonly number[], prior: number): number {
  const total = all.reduce((s, v) => s + v, 0);
  if (total <= 0) return 1;
  const share = (v: number) => (v + prior * total / all.length) / (total * (1 + prior));
  const best = Math.max(...all.map(share));
  return best > 0 ? share(value) / best : 1;
}

/** Pur : l'adéquation d'un candidat (0..1) — moyenne de la notoriété et de l'époque. */
export function calibrationFit(cal: AccountCalibration, voteCount: number | null, year: number | null): number {
  const pop = fitOf(cal.popularity[popularityClass(voteCount)] ?? 0, cal.popularity, POPULARITY_PRIOR);
  if (year == null || cal.era.size === 0) return pop;
  const decades = [...cal.era.values()];
  const era = fitOf(cal.era.get(decadeOf(year)) ?? 0, decades, ERA_PRIOR);
  return (pop + era) / 2;
}
