import { describe, expect, it } from "vitest";
import type { ViewingStats } from "../types/viewingStats";
import { viewerBadges } from "./badges";
import { analyzeRhythm, heatLevel, niceAxis } from "./insights";

const H = 3600;

function grid(cells: Array<[weekday: number, hour: number, seconds: number]>): number[] {
  const g = new Array<number>(168).fill(0);
  for (const [d, h, s] of cells) g[d * 24 + h] += s;
  return g;
}

function stats(over: Partial<ViewingStats> = {}): ViewingStats {
  return {
    period: "all", timeZone: "Europe/Paris", generatedAt: "", measuredSince: null, hasHistory: true,
    totals: { seconds: 10 * H, measuredSeconds: 10 * H, estimatedSeconds: 0, movies: 0, episodes: 20, series: 2, activeDays: 5 },
    timeline: { unit: "month", buckets: [], undatedSeconds: 0 },
    rhythm: { grid: grid([]) },
    split: { movieSeconds: 0, seriesSeconds: 10 * H, animeSeconds: 0 },
    genres: [], languages: [], decades: [], devices: [], topSeries: [], movies: [], moviesOrder: "preference",
    origins: { countries: [], otherShare: 0, unknownShare: 0 },
    listening: { versions: null, versionSeconds: 0, languages: [], otherShare: 0, knownSeconds: 0, since: null },
    people: { actors: [], directors: [] },
    records: { biggestDay: null, longestStreak: null, binge: null, longestSession: null },
    taste: { available: false, computedAt: null, animeShare: 0, loved: [], signals: {
      ratings: 0, ratingAverage: null, superlikes: 0, likes: 0, dislikes: 0, likedPeople: 0, favorites: 0 }, potential: null },
    ...over,
  };
}

describe("la lecture du rythme", () => {
  it("trouve le jour, l'heure et le moment de la journée dominants", () => {
    const r = analyzeRhythm(grid([[5, 21, 3 * H], [5, 22, H], [2, 8, H]]));
    expect(r.totalSeconds).toBe(5 * H);
    expect(r.topWeekday).toBe(5);
    expect(r.topHour).toBe(21);
    expect(r.topDaypart).toBe("evening");
    expect(r.weekendShare).toBeCloseTo(0.8);
    expect(r.lateShare).toBeCloseTo(0.2);
    expect(r.earlyShare).toBeCloseTo(0.2);
  });

  it("range la nuit à cheval sur minuit", () => {
    const r = analyzeRhythm(grid([[0, 23, H], [1, 2, H]]));
    expect(r.dayparts.night).toBeCloseTo(1);
    expect(r.topDaypart).toBe("night");
  });

  it("ne dit rien sans mesure", () => {
    const r = analyzeRhythm(grid([]));
    expect(r).toMatchObject({ totalSeconds: 0, topWeekday: null, topHour: null, topDaypart: null, weekendShare: 0 });
  });
});

describe("l'échelle et les niveaux", () => {
  it("arrondit l'axe à des pas lisibles", () => {
    expect(niceAxis(7.3)).toEqual({ max: 8, step: 2, ticks: [0, 2, 4, 6, 8] });
    expect(niceAxis(38)).toEqual({ max: 40, step: 10, ticks: [0, 10, 20, 30, 40] });
    expect(niceAxis(0.6).max).toBeCloseTo(0.6);
    expect(niceAxis(0)).toEqual({ max: 1, step: 1, ticks: [0, 1] });
  });

  it("gradue la grille en quatre niveaux, zéro à part", () => {
    expect([0, 1, 25, 26, 100].map((v) => heatLevel(v, 100))).toEqual([0, 1, 1, 2, 4]);
  });
});

describe("le profil de spectateur", () => {
  it("ne donne aucun trait sur trop peu de temps", () => {
    expect(viewerBadges(stats({ totals: { ...stats().totals, seconds: H } }))).toEqual([]);
  });

  it("reconnaît l'oiseau de nuit et le fan d'animés, chiffres à l'appui, le plus marqué d'abord", () => {
    const s = stats({
      rhythm: { grid: grid([[5, 23, 6 * H], [5, 1, 2 * H], [6, 20, 2 * H]]) },
      split: { movieSeconds: H, seriesSeconds: 1.5 * H, animeSeconds: 7.5 * H },
    });
    const badges = viewerBadges(s);
    expect(badges.map((b) => b.key)).toEqual(["nightOwl", "animeFan", "weekend"]);
    expect(badges[0].share).toBeCloseTo(0.8);
    expect(badges[1].share).toBeCloseTo(0.75);
  });

  it("garde au plus trois traits", () => {
    const s = stats({
      rhythm: { grid: grid([[5, 23, 10 * H]]) },
      records: { biggestDay: null, longestStreak: { days: 14, from: "", to: "" }, binge: { seriesId: "s", seriesName: "Dark", episodes: 9, seconds: 7 * H, date: "" }, longestSession: null },
    });
    expect(viewerBadges(s)).toHaveLength(3);
    expect(viewerBadges(s, 5).map((b) => b.key)).toContain("binger");
  });
});
