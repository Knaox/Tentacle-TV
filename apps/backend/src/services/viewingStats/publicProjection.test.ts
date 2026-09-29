import { describe, expect, it } from "vitest";
import type { ViewingStats } from "./contract";
import { publicTitleIds, toPublicStats } from "./publicProjection";

/**
 * La page publique d'un lien de statistiques ne reçoit que la liste blanche :
 * ce test garde à la fois ce qui ne doit JAMAIS sortir (heures, écrans,
 * fuseau, dates exactes, « À voir ») et la forme exacte de la réponse — un
 * champ de plus, même anodin, doit être décidé, pas hérité.
 */

const H = 3600;

function ownerStats(): ViewingStats {
  const grid = new Array<number>(168).fill(0);
  grid[4 * 24 + 23] = 3 * H; // vendredi 23 h
  grid[5 * 24 + 21] = 2 * H; // samedi 21 h
  grid[2 * 24 + 8] = H; // mercredi 8 h
  return {
    period: "30d",
    timeZone: "Europe/Zurich",
    generatedAt: "2026-09-29T11:47:12.345Z",
    measuredSince: "2026-06-02T19:31:08.000Z",
    hasHistory: true,
    totals: { seconds: 40 * H, measuredSeconds: 6 * H, estimatedSeconds: 34 * H, movies: 3, episodes: 21, series: 2, activeDays: 9 },
    timeline: { unit: "day", buckets: [{ key: "2026-09-12", measuredSeconds: 2 * H, estimatedSeconds: 0 }], undatedSeconds: 0 },
    rhythm: { grid },
    split: { movieSeconds: 6 * H, seriesSeconds: 30 * H, animeSeconds: 4 * H },
    genres: [{ key: "18", label: "Drame", seconds: 20 * H, share: 0.5 }],
    languages: [],
    origins: { countries: [{ key: "US", label: "États-Unis", seconds: 30 * H, share: 0.75 }], otherShare: 0.2, unknownShare: 0.05 },
    listening: {
      versions: { original: 0.3, local: 0.7, otherDubs: 0 },
      versionSeconds: 5 * H,
      languages: [{ key: "fr", label: "Français", seconds: 4 * H, share: 0.8 }],
      otherShare: 0.2,
      knownSeconds: 5 * H,
      since: "2026-09-20T22:43:10.000Z",
    },
    decades: [{ decade: 1990, seconds: 6 * H }],
    devices: [{ device: "other", seconds: 2 * H, client: "Infuse du salon" }],
    topSeries: [{
      id: "s1", name: "Dark", kind: "series", seconds: 30 * H, episodes: 21, viewings: 0, rating: 9, favorite: true, verdict: "superlike",
      year: 2017, anime: false, primaryTag: "p1", backdropTag: "b1", lastPlayedAt: "2026-09-27T01:12:00.000Z",
    }],
    movies: [{
      id: "m1", name: "Heat", kind: "movie", seconds: 3 * H, episodes: 0, viewings: 2, rating: 10, favorite: false, verdict: null,
      year: 1995, anime: false, primaryTag: "p2", backdropTag: "b2", lastPlayedAt: "2026-09-26T23:58:00.000Z",
    }],
    moviesOrder: "preference",
    people: { actors: [{ tmdbId: 1, name: "Al Pacino", profilePath: "/al.jpg", role: "actor", titles: 2, seconds: 5 * H }], directors: [] },
    records: {
      biggestDay: { date: "2026-09-14", seconds: 9 * H },
      longestStreak: { days: 6, from: "2026-08-28", to: "2026-09-02" },
      binge: { seriesId: "s1", seriesName: "Dark", episodes: 5, seconds: 4 * H, date: "2026-09-14" },
      longestSession: { title: "Heat", seconds: 3 * H, date: "2026-09-26" },
    },
    taste: {
      available: true,
      computedAt: "2026-09-29T03:00:00.000Z",
      animeShare: 0.1,
      loved: [
        { key: "tv:70523", mediaType: "tv", tmdbId: 70523, title: "Dark", jellyfinId: "s1", posterPath: "/dark.jpg", reasons: ["superlike"], rating: 9, hours: 30 },
        { key: "movie:603", mediaType: "movie", tmdbId: 603, title: "Matrix", jellyfinId: null, posterPath: "/m.jpg", reasons: ["like"], rating: null, hours: 0 },
      ],
      signals: { ratings: 12, ratingAverage: 7.5, superlikes: 3, likes: 8, dislikes: 2, likedPeople: 1, favorites: 4 },
      potential: { count: 1, titles: [{ key: "movie:1", mediaType: "movie", tmdbId: 1, title: "Titre secret de Ma liste", jellyfinId: "w1", posterPath: null }] },
    },
  };
}

/**
 * Tous les chemins de clés d'une valeur JSON, les tableaux repliés en « [] » ;
 * un tableau vide ou de valeurs simples se note lui-même (« reasons[] »).
 */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    const inner = [...new Set(value.flatMap((v) => keyPaths(v, `${prefix}[]`)))];
    return inner.length ? inner : [`${prefix}[]`];
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => [`${prefix}.${k}`, ...keyPaths(v, `${prefix}.${k}`)]);
  }
  return [];
}

describe("la projection publique des statistiques", () => {
  const pub = toPublicStats(ownerStats());
  const json = JSON.stringify(pub);

  it("ne laisse sortir ni fuseau, ni écran, ni heure, ni dernière lecture, ni « À voir »", () => {
    for (const secret of [
      "Europe/Zurich", "Infuse", "Titre secret", "w1", "timeZone", "devices", "grid", "lastPlayedAt", "backdropTag",
      "potential", "computedAt", "languages\":[]", "moviesOrder",
      "23:58", "01:12", "22:43", "19:31", "11:47", "2026-09-14", "2026-08-28", "2026-09-26T",
    ]) {
      expect(json, secret).not.toContain(secret);
    }
  });

  it("date les records au mois, et les instants au jour du propriétaire, à midi UTC", () => {
    expect(pub.records.biggestDay?.date).toBe("2026-09");
    expect(pub.records.longestStreak).toEqual({ days: 6, from: "2026-08", to: "2026-09" });
    expect(pub.records.binge?.date).toBe("2026-09");
    expect(pub.records.longestSession?.date).toBe("2026-09");
    // 22 h 43 UTC le 20 = 0 h 43 le 21 à Zurich : c'est le jour du propriétaire qui compte.
    expect(pub.listening.since).toBe("2026-09-21T12:00:00.000Z");
    expect(pub.measuredSince).toBe("2026-06-02T12:00:00.000Z");
    expect(pub.generatedAt).toBe("2026-09-29T12:00:00.000Z");
  });

  it("remplace la grille par ses habitudes à gros grain", () => {
    expect(pub.habits.measuredSeconds).toBe(6 * H);
    expect(pub.habits.dayparts.night).toBeCloseTo(0.5);
    expect(pub.habits.dayparts.evening).toBeCloseTo(2 / 6);
    expect(pub.habits.dayparts.morning).toBeCloseTo(1 / 6);
    expect(pub.habits.weekendShare).toBeCloseTo(2 / 6);
    expect(pub.habits.lateShare).toBeCloseTo(0.5);
  });

  it("garde ce qui se partage : chiffres, titres classés, avis, visages, goût", () => {
    expect(pub.totals.seconds).toBe(40 * H);
    expect(pub.movies[0]).toMatchObject({ id: "m1", name: "Heat", rating: 10, viewings: 2, primaryTag: "p2" });
    expect(pub.topSeries[0]).toMatchObject({ id: "s1", verdict: "superlike", favorite: true });
    expect(pub.people.actors[0].name).toBe("Al Pacino");
    expect(pub.taste.loved.map((l) => l.title)).toEqual(["Dark", "Matrix"]);
    expect(pub.taste.signals.ratingAverage).toBe(7.5);
  });

  it("n'ouvre que les fiches des titres de bibliothèque qu'elle montre", () => {
    expect([...publicTitleIds(pub)].sort()).toEqual(["m1", "s1"]);
  });

  it("a exactement la forme décidée — pas un champ de plus", () => {
    expect(keyPaths(pub).sort()).toEqual([
      ".decades", ".decades[].decade", ".decades[].seconds",
      ".generatedAt",
      ".genres", ".genres[].key", ".genres[].label", ".genres[].seconds", ".genres[].share",
      ".habits", ".habits.dayparts", ".habits.dayparts.afternoon", ".habits.dayparts.evening", ".habits.dayparts.morning",
      ".habits.dayparts.night", ".habits.earlyShare", ".habits.lateShare", ".habits.measuredSeconds", ".habits.weekendShare",
      ".hasHistory",
      ".listening", ".listening.knownSeconds", ".listening.languages", ".listening.languages[].key", ".listening.languages[].label",
      ".listening.languages[].seconds", ".listening.languages[].share", ".listening.otherShare", ".listening.since",
      ".listening.versionSeconds", ".listening.versions", ".listening.versions.local", ".listening.versions.original",
      ".listening.versions.otherDubs",
      ".measuredSince",
      ".movies", ".movies[].anime", ".movies[].episodes", ".movies[].favorite", ".movies[].id", ".movies[].kind", ".movies[].name",
      ".movies[].primaryTag", ".movies[].rating", ".movies[].seconds", ".movies[].verdict", ".movies[].viewings", ".movies[].year",
      ".origins", ".origins.countries", ".origins.countries[].key", ".origins.countries[].label", ".origins.countries[].seconds",
      ".origins.countries[].share", ".origins.otherShare", ".origins.unknownShare",
      ".people", ".people.actors", ".people.actors[].name", ".people.actors[].profilePath", ".people.actors[].role",
      ".people.actors[].seconds", ".people.actors[].titles", ".people.actors[].tmdbId", ".people.directors", ".people.directors[]",
      ".period",
      ".records", ".records.biggestDay", ".records.biggestDay.date", ".records.biggestDay.seconds", ".records.binge",
      ".records.binge.date", ".records.binge.episodes", ".records.binge.seconds", ".records.binge.seriesId", ".records.binge.seriesName",
      ".records.longestSession", ".records.longestSession.date", ".records.longestSession.seconds", ".records.longestSession.title",
      ".records.longestStreak", ".records.longestStreak.days", ".records.longestStreak.from", ".records.longestStreak.to",
      ".split", ".split.animeSeconds", ".split.movieSeconds", ".split.seriesSeconds",
      ".taste", ".taste.animeShare", ".taste.available", ".taste.loved", ".taste.loved[].hours", ".taste.loved[].jellyfinId",
      ".taste.loved[].key", ".taste.loved[].mediaType", ".taste.loved[].posterPath", ".taste.loved[].rating", ".taste.loved[].reasons",
      ".taste.loved[].reasons[]", ".taste.loved[].title", ".taste.loved[].tmdbId", ".taste.signals", ".taste.signals.dislikes",
      ".taste.signals.favorites", ".taste.signals.likedPeople", ".taste.signals.likes", ".taste.signals.ratingAverage",
      ".taste.signals.ratings", ".taste.signals.superlikes",
      ".timeline", ".timeline.buckets", ".timeline.buckets[].estimatedSeconds", ".timeline.buckets[].key",
      ".timeline.buckets[].measuredSeconds", ".timeline.undatedSeconds", ".timeline.unit",
      ".topSeries", ".topSeries[].anime", ".topSeries[].episodes", ".topSeries[].favorite", ".topSeries[].id", ".topSeries[].kind",
      ".topSeries[].name", ".topSeries[].primaryTag", ".topSeries[].rating", ".topSeries[].seconds", ".topSeries[].verdict",
      ".topSeries[].viewings", ".topSeries[].year",
      ".totals", ".totals.activeDays", ".totals.episodes", ".totals.estimatedSeconds", ".totals.measuredSeconds", ".totals.movies",
      ".totals.seconds", ".totals.series",
    ].sort());
  });
});
