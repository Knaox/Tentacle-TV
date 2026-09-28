import type {
  ViewingStatsDecade,
  ViewingStatsDeviceShare,
  ViewingStatsPeriod,
  ViewingStatsPerson,
  ViewingStatsRecords,
  ViewingStatsRhythm,
  ViewingStatsSplit,
  ViewingStatsTimeline,
  ViewingStatsTitle,
  ViewingStatsTotals,
} from "./contract";
import type { StatsDataset, TitleInfo } from "./dataset";
import { accumulate, periodWindow } from "./accumulate";
import type { TitleTotal } from "./accumulate";
import { buildTimeline } from "./timeline";
import { buildRhythm } from "./rhythm";
import { buildRecords } from "./records";
import { NOISE_SECONDS, decadesOf, devicesOf, genreAndLanguageShares, peopleOf, secondsOf, splitOf } from "./distributions";
import type { KeyedShare } from "./distributions";
import type { LocalCalendar } from "./localCalendar";

export const TOP_SERIES_MAX = 10;
export const MOVIES_MAX = 12;

/** Une période calculée, sans libellé (posé à la réponse, dans la langue du client). */
export interface PeriodCore {
  totals: ViewingStatsTotals;
  timeline: ViewingStatsTimeline;
  rhythm: ViewingStatsRhythm;
  split: ViewingStatsSplit;
  genres: KeyedShare[];
  languages: KeyedShare[];
  decades: ViewingStatsDecade[];
  devices: ViewingStatsDeviceShare[];
  topSeries: ViewingStatsTitle[];
  movies: ViewingStatsTitle[];
  people: { actors: ViewingStatsPerson[]; directors: ViewingStatsPerson[] };
  records: ViewingStatsRecords;
}

function toTitle(t: TitleTotal, info: TitleInfo): ViewingStatsTitle {
  return {
    id: info.id,
    name: info.name,
    kind: info.kind,
    seconds: Math.round(secondsOf(t)),
    episodes: info.kind === "series" ? t.played : 0,
    viewings: info.kind === "movie" ? t.viewings : 0,
    year: info.year,
    anime: info.anime,
    primaryTag: null,
    backdropTag: null,
    lastPlayedAt: t.lastActiveAt === null ? null : new Date(t.lastActiveAt).toISOString(),
  };
}

/** Une période complète, du jeu de données au résumé servi. Fonction pure. */
export function computePeriod(
  data: StatsDataset,
  period: ViewingStatsPeriod,
  calendar: LocalCalendar,
  now: number
): PeriodCore {
  const win = periodWindow(period, calendar, now);
  const acc = accumulate(data, win, calendar);
  const totals = [...acc.byTitle.values()];
  const totalSeconds = acc.measuredSeconds + acc.estimatedSeconds;
  const withInfo = totals
    .map((t) => ({ t, info: data.titles.get(t.titleId) }))
    .filter((x): x is { t: TitleTotal; info: TitleInfo } => x.info !== undefined);

  // Une série compte dès un épisode vu, ou une minute mesurée (pas une lecture d'essai).
  const watched = (t: TitleTotal) => t.played > 0 || secondsOf(t) >= NOISE_SECONDS;
  const topSeries = withInfo
    .filter(({ t, info }) => info.kind === "series" && watched(t))
    .sort((a, b) => secondsOf(b.t) - secondsOf(a.t) || b.t.played - a.t.played)
    .slice(0, TOP_SERIES_MAX)
    .map(({ t, info }) => toTitle(t, info));

  const movies = withInfo
    .filter(({ t, info }) => info.kind === "movie" && (t.played > 0 || t.viewings > 0))
    .sort((a, b) => (b.t.lastActiveAt ?? 0) - (a.t.lastActiveAt ?? 0))
    .slice(0, MOVIES_MAX)
    .map(({ t, info }) => toTitle(t, info));

  const series = withInfo.filter(({ t, info }) => info.kind === "series" && watched(t)).length;
  const { records, activeDays } = buildRecords(data, win, calendar, (id) => data.titles.get(id)?.name ?? "");
  const { genres, languages } = genreAndLanguageShares(totals, data.titles, totalSeconds);

  return {
    totals: {
      seconds: Math.round(totalSeconds),
      measuredSeconds: Math.round(acc.measuredSeconds),
      estimatedSeconds: Math.round(acc.estimatedSeconds),
      movies: acc.movies,
      episodes: acc.episodes,
      series,
      activeDays,
    },
    timeline: buildTimeline(data, win, calendar, acc.undatedSeconds),
    rhythm: { grid: buildRhythm(data.measured, win, calendar) },
    split: splitOf(totals, data.titles),
    genres,
    languages,
    decades: decadesOf(totals, data.titles),
    devices: devicesOf(data.measured, win, calendar),
    topSeries,
    movies,
    people: peopleOf(totals, data.titles),
    records,
  };
}
