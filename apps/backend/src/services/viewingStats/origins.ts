import type { TitleTotal } from "./accumulate";
import type { TitleInfo } from "./dataset";
import { rankedShares, secondsOf } from "./distributions";
import type { KeyedShare } from "./distributions";

export const COUNTRIES_MAX = 6;

/** « Origine des titres » d'une période, sans libellé (posé à la réponse). */
export interface OriginsCore {
  countries: KeyedShare[];
  otherShare: number;
  unknownShare: number;
}

export const clampShare = (x: number): number => Math.min(1, Math.max(0, x));

/**
 * D'où viennent les titres : le PREMIER pays d'origine de chacun (fiche
 * TMDB), pondéré par le temps passé devant lui — le pays où il a été produit,
 * pas la langue dans laquelle on l'a écouté. Rien n'est deviné pour un titre
 * sans fiche : son temps va à « origine inconnue ». Pays + autres + inconnue
 * font le tout.
 */
export function originsOf(totals: Iterable<TitleTotal>, titles: Map<string, TitleInfo>, totalSeconds: number): OriginsCore {
  const byCountry = new Map<string, number>();
  let known = 0;
  for (const t of totals) {
    const origin = titles.get(t.titleId)?.origin;
    const s = secondsOf(t);
    if (!origin || s <= 0) continue;
    byCountry.set(origin, (byCountry.get(origin) ?? 0) + s);
    known += s;
  }
  if (totalSeconds <= 0 || known <= 0) return { countries: [], otherShare: 0, unknownShare: totalSeconds > 0 ? 1 : 0 };
  const countries = rankedShares(byCountry, totalSeconds, COUNTRIES_MAX);
  const listed = countries.reduce((n, c) => n + (byCountry.get(c.key) ?? 0), 0);
  return {
    countries,
    otherShare: clampShare((known - listed) / totalSeconds),
    unknownShare: clampShare((totalSeconds - known) / totalSeconds),
  };
}
