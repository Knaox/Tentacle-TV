import { tmdbGenreName } from "../swipe/tmdbGenres";
import type { ViewingStats, ViewingStatsPeriod, ViewingStatsTaste } from "./contract";
import type { PeriodCore } from "./computePeriod";
import { versionsFor } from "./listening";

export type StatsLang = "fr" | "en";

/** Un calcul complet d'un compte : les trois périodes et le goût, sans libellé. */
export interface ComputedStats {
  timeZone: string;
  generatedAt: string;
  measuredSince: string | null;
  /** Première séance dont la piste audio a été relevée (ISO) ; null : jamais. */
  listeningSince: string | null;
  hasHistory: boolean;
  periods: Record<ViewingStatsPeriod, PeriodCore>;
  taste: ViewingStatsTaste;
}

type NameKind = "language" | "region";
const namers = new Map<string, Intl.DisplayNames | null>();

function displayNames(lang: StatsLang, kind: NameKind): Intl.DisplayNames | null {
  const key = `${lang}|${kind}`;
  if (!namers.has(key)) {
    try {
      namers.set(key, new Intl.DisplayNames([lang], { type: kind }));
    } catch {
      namers.set(key, null);
    }
  }
  return namers.get(key) ?? null;
}

function displayName(code: string, lang: StatsLang, kind: NameKind): string {
  let name: string | undefined;
  try {
    name = displayNames(lang, kind)?.of(code);
  } catch {
    name = undefined;
  }
  if (!name || name.toLowerCase() === code.toLowerCase()) return code.toUpperCase();
  return name.charAt(0).toLocaleUpperCase(lang) + name.slice(1);
}

/**
 * Le nom d'une langue (« ja » → « Japonais ») ou d'un pays (« KR » → « Corée
 * du Sud ») dans celle du client, par le moteur ICU du serveur — le client
 * mobile (Hermes) n'a pas `Intl.DisplayNames`, c'est donc ici qu'il se calcule.
 */
export const languageName = (code: string, lang: StatsLang): string => displayName(code, lang, "language");
export const countryName = (code: string, lang: StatsLang): string => displayName(code, lang, "region");

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
    // Vide pour de bon : c'était la langue ORIGINALE, que les anciens clients prenaient pour la langue écoutée.
    languages: [],
    origins: {
      countries: core.origins.countries.map((o) => ({ ...o, label: countryName(o.key, lang) })),
      otherShare: core.origins.otherShare,
      unknownShare: core.origins.unknownShare,
    },
    listening: {
      versions: versionsFor(core.listening, lang),
      versionSeconds: Math.round(core.listening.versionSeconds),
      languages: core.listening.languages.map((l) => ({ ...l, label: languageName(l.key, lang) })),
      otherShare: core.listening.otherShare,
      knownSeconds: Math.round(core.listening.knownSeconds),
      since: c.listeningSince,
    },
    decades: core.decades,
    devices: core.devices,
    topSeries: core.topSeries,
    movies: core.movies,
    moviesOrder: "preference",
    people: core.people,
    records: core.records,
    taste: c.taste,
  };
}
