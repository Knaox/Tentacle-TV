import { tmdbGenreName } from "../swipe/tmdbGenres";
import type { ViewingStats, ViewingStatsPeriod, ViewingStatsTaste } from "./contract";
import type { PeriodCore } from "./computePeriod";

export type StatsLang = "fr" | "en";

/** Un calcul complet d'un compte : les trois périodes et le goût, sans libellé. */
export interface ComputedStats {
  timeZone: string;
  generatedAt: string;
  measuredSince: string | null;
  hasHistory: boolean;
  periods: Record<ViewingStatsPeriod, PeriodCore>;
  taste: ViewingStatsTaste;
}

const languageNames = new Map<StatsLang, Intl.DisplayNames | null>();

function displayNames(lang: StatsLang): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames([lang], { type: "language" });
  } catch {
    return null;
  }
}

/**
 * Le nom d'une langue dans celle du client (« japonais » → « Japonais »), par
 * le moteur ICU du serveur — le client mobile (Hermes) n'a pas
 * `Intl.DisplayNames`, c'est donc ici qu'il se calcule.
 */
export function languageName(code: string, lang: StatsLang): string {
  if (!languageNames.has(lang)) languageNames.set(lang, displayNames(lang));
  let name: string | undefined;
  try {
    name = languageNames.get(lang)?.of(code);
  } catch {
    name = undefined;
  }
  if (!name || name === code) return code.toUpperCase();
  return name.charAt(0).toLocaleUpperCase(lang) + name.slice(1);
}

/** La réponse d'une période, libellés posés dans la langue demandée. */
export function presentStats(c: ComputedStats, period: ViewingStatsPeriod, lang: StatsLang): ViewingStats {
  const core = c.periods[period];
  return {
    period,
    timeZone: c.timeZone,
    generatedAt: c.generatedAt,
    measuredSince: c.measuredSince,
    hasHistory: c.hasHistory,
    totals: core.totals,
    timeline: core.timeline,
    rhythm: core.rhythm,
    split: core.split,
    genres: core.genres.map((g) => ({ ...g, label: tmdbGenreName(Number(g.key), lang) ?? g.key })),
    languages: core.languages.map((l) => ({ ...l, label: languageName(l.key, lang) })),
    decades: core.decades,
    devices: core.devices,
    topSeries: core.topSeries,
    movies: core.movies,
    people: core.people,
    records: core.records,
    taste: c.taste,
  };
}
