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
import type { Judgments, StatsDataset, TitleInfo } from "./dataset";
import { accumulate, periodWindow } from "./accumulate";
import type { TitleTotal } from "./accumulate";
import { buildTimeline } from "./timeline";
import { buildRhythm } from "./rhythm";
import { buildRecords } from "./records";
import { NOISE_SECONDS, decadesOf, devicesOf, genreShares, secondsOf, splitOf } from "./distributions";
import type { KeyedShare } from "./distributions";
import { judgmentKey } from "./judgments";
import { listeningOf } from "./listening";
import type { ListeningCore } from "./listening";
import type { LocalCalendar } from "./localCalendar";
import { byPreference } from "./movieRanking";
import { originsOf } from "./origins";
import type { OriginsCore } from "./origins";
import { peopleOf } from "./people";

export const TOP_SERIES_MAX = 10;
export const MOVIES_MAX = 15;

/** Une période calculée, sans libellé (posé à la réponse, dans la langue du client). */
export interface PeriodCore {
  totals: ViewingStatsTotals;
  timeline: ViewingStatsTimeline;
  rhythm: ViewingStatsRhythm;
  split: ViewingStatsSplit;
  genres: KeyedShare[];
  origins: OriginsCore;
  listening: ListeningCore;
  decades: ViewingStatsDecade[];
  devices: ViewingStatsDeviceShare[];
  topSeries: ViewingStatsTitle[];
  movies: ViewingStatsTitle[];
  people: { actors: ViewingStatsPerson[]; directors: ViewingStatsPerson[] };
  records: ViewingStatsRecords;
}

function toTitle(t: TitleTotal, info: TitleInfo, judgments: Judgments): ViewingStatsTitle {
  const key = info.tmdbId ? judgmentKey(info.kind === "movie" ? "movie" : "tv", info.tmdbId) : null;
  return {
    id: info.id,
    name: info.name,
    kind: info.kind,
    seconds: Math.round(secondsOf(t)),
    episodes: info.kind === "series" ? t.played : 0,
    // Marqué « vu » : une fois au moins ; la mesure en voit davantage quand il a été revu.
    viewings: info.kind === "movie" ? Math.max(t.played > 0 ? 1 : 0, t.viewings) : 0,
    rating: key ? judgments.ratings.get(key) ?? null : null,
    favorite: judgments.favorites.has(info.id),
    verdict: key ? judgments.verdicts.get(key) ?? null : null,
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
    .map(({ t, info }) => toTitle(t, info, data.judgments));

  // Les films, du préféré au moins aimé — critères dans `movieRanking.ts`.
  const movies = withInfo
    .filter(({ t, info }) => info.kind === "movie" && (t.played > 0 || t.viewings > 0))
    .map(({ t, info }) => toTitle(t, info, data.judgments))
    .sort(byPreference)
    .slice(0, MOVIES_MAX);

  const series = withInfo.filter(({ t, info }) => info.kind === "series" && watched(t)).length;
  const { records, activeDays } = buildRecords(data, win, calendar, (id) => data.titles.get(id)?.name ?? "");

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
    genres: genreShares(totals, data.titles, totalSeconds),
    origins: originsOf(totals, data.titles, totalSeconds),
    listening: listeningOf(data.measured, win, calendar, data.titles),
    decades: decadesOf(totals, data.titles),
    devices: devicesOf(data.measured, win, calendar),
    topSeries,
    movies,
    people: peopleOf(totals, data.titles),
    records,
  };
}
