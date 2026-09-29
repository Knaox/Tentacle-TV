import type {
  ViewingStats,
  ViewingStatsLabeledShare,
  ViewingStatsPerson,
  ViewingStatsRecords,
  ViewingStatsTasteTitle,
  ViewingStatsTitle,
} from "./contract";
import type { PublicStatsTaste, PublicStatsTitle, PublicViewingStats } from "./contractShare";
import { habitsOf } from "./habits";
import { LocalCalendar } from "./localCalendar";

/**
 * Ce que reçoit la page PUBLIQUE d'un lien de statistiques, tiré des
 * statistiques du propriétaire — construit champ par champ, jamais par copie :
 * un champ ajouté demain à la réponse du propriétaire ne sort pas d'ici tant
 * que personne ne l'y écrit (cf. `contractShare.ts`).
 *
 * Ce qui reste au serveur : la grille jour × heure (seules ses habitudes à
 * gros grain partent), les écrans, le fuseau, la dernière lecture de chaque
 * titre, « À voir » et la date du profil. Les records se datent au mois ; les
 * autres instants au jour, posés à midi UTC — ils se lisent au même jour de
 * Honolulu à Auckland, sans l'heure.
 */

const monthOf = (dateKey: string): string => dateKey.slice(0, 7);

const shareOf = (s: ViewingStatsLabeledShare): ViewingStatsLabeledShare => ({
  key: s.key, label: s.label, seconds: s.seconds, share: s.share,
});

const titleOf = (t: ViewingStatsTitle): PublicStatsTitle => ({
  id: t.id,
  name: t.name,
  kind: t.kind,
  seconds: t.seconds,
  episodes: t.episodes,
  viewings: t.viewings,
  rating: t.rating,
  favorite: t.favorite,
  verdict: t.verdict,
  year: t.year,
  anime: t.anime,
  primaryTag: t.primaryTag,
});

const personOf = (p: ViewingStatsPerson): ViewingStatsPerson => ({
  tmdbId: p.tmdbId, name: p.name, profilePath: p.profilePath, role: p.role, titles: p.titles, seconds: p.seconds,
});

const lovedOf = (l: ViewingStatsTasteTitle): ViewingStatsTasteTitle => ({
  key: l.key,
  mediaType: l.mediaType,
  tmdbId: l.tmdbId,
  title: l.title,
  jellyfinId: l.jellyfinId,
  posterPath: l.posterPath,
  reasons: [...l.reasons],
  rating: l.rating,
  hours: l.hours,
});

function recordsOf(r: ViewingStatsRecords): ViewingStatsRecords {
  const { biggestDay, longestStreak, binge, longestSession } = r;
  return {
    biggestDay: biggestDay && { date: monthOf(biggestDay.date), seconds: biggestDay.seconds },
    longestStreak: longestStreak && { days: longestStreak.days, from: monthOf(longestStreak.from), to: monthOf(longestStreak.to) },
    binge: binge && {
      seriesId: binge.seriesId, seriesName: binge.seriesName, episodes: binge.episodes, seconds: binge.seconds, date: monthOf(binge.date),
    },
    longestSession: longestSession && { title: longestSession.title, seconds: longestSession.seconds, date: monthOf(longestSession.date) },
  };
}

function tasteOf(t: ViewingStats["taste"]): PublicStatsTaste {
  const s = t.signals;
  return {
    available: t.available,
    animeShare: t.animeShare,
    loved: t.loved.map(lovedOf),
    signals: {
      ratings: s.ratings, ratingAverage: s.ratingAverage, superlikes: s.superlikes, likes: s.likes,
      dislikes: s.dislikes, likedPeople: s.likedPeople, favorites: s.favorites,
    },
  };
}

export function toPublicStats(s: ViewingStats): PublicViewingStats {
  const calendar = new LocalCalendar(s.timeZone);
  const dayOnly = (iso: string | null): string | null => {
    const ms = iso ? Date.parse(iso) : NaN;
    return Number.isNaN(ms) ? null : `${calendar.parts(ms).day}T12:00:00.000Z`;
  };
  const { totals, timeline, split, origins, listening } = s;
  return {
    period: s.period,
    generatedAt: dayOnly(s.generatedAt) ?? s.generatedAt.slice(0, 10),
    measuredSince: dayOnly(s.measuredSince),
    hasHistory: s.hasHistory,
    totals: {
      seconds: totals.seconds,
      measuredSeconds: totals.measuredSeconds,
      estimatedSeconds: totals.estimatedSeconds,
      movies: totals.movies,
      episodes: totals.episodes,
      series: totals.series,
      activeDays: totals.activeDays,
    },
    timeline: {
      unit: timeline.unit,
      buckets: timeline.buckets.map((b) => ({ key: b.key, measuredSeconds: b.measuredSeconds, estimatedSeconds: b.estimatedSeconds })),
      undatedSeconds: timeline.undatedSeconds,
    },
    habits: habitsOf(s.rhythm.grid),
    split: { movieSeconds: split.movieSeconds, seriesSeconds: split.seriesSeconds, animeSeconds: split.animeSeconds },
    genres: s.genres.map(shareOf),
    origins: { countries: origins.countries.map(shareOf), otherShare: origins.otherShare, unknownShare: origins.unknownShare },
    listening: {
      versions: listening.versions && {
        original: listening.versions.original, local: listening.versions.local, otherDubs: listening.versions.otherDubs,
      },
      versionSeconds: listening.versionSeconds,
      languages: listening.languages.map(shareOf),
      otherShare: listening.otherShare,
      knownSeconds: listening.knownSeconds,
      since: dayOnly(listening.since),
    },
    decades: s.decades.map((d) => ({ decade: d.decade, seconds: d.seconds })),
    topSeries: s.topSeries.map(titleOf),
    movies: s.movies.map(titleOf),
    people: { actors: s.people.actors.map(personOf), directors: s.people.directors.map(personOf) },
    records: recordsOf(s.records),
    taste: tasteOf(s.taste),
  };
}

/** Les titres de la bibliothèque que la page publique montre — seuls leurs fiches publiques s'ouvrent. */
export function publicTitleIds(p: PublicViewingStats): Set<string> {
  const ids = new Set<string>();
  for (const t of [...p.movies, ...p.topSeries]) ids.add(t.id);
  for (const l of p.taste.loved) if (l.jellyfinId) ids.add(l.jellyfinId);
  return ids;
}
