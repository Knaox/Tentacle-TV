import { describe, expect, it } from "vitest";
import type { ViewingStats } from "../types/viewingStats";
import type { PublicViewingStats } from "../types/viewingStatsShare";
import { viewerBadges } from "./badges";
import { habitsOf } from "./habits";
import { analyzeRhythm, habitsInsight } from "./insights";
import { viewingStatsFromPublic } from "./publicStats";

/**
 * La page publique ne reçoit pas la grille jour × heure, seulement ses
 * habitudes à gros grain. Elles doivent dire EXACTEMENT ce que la grille dit
 * des moments de la journée — sinon « Oiseau de nuit » se gagnerait sur une
 * page et pas sur l'autre.
 */

const H = 3600;

function grid(cells: Array<[weekday: number, hour: number, seconds: number]>): number[] {
  const g = new Array<number>(168).fill(0);
  for (const [d, h, s] of cells) g[d * 24 + h] += s;
  return g;
}

/** Une grille chargée, pseudo-aléatoire mais stable : de quoi remplir chaque moment. */
function busyGrid(seed: number): number[] {
  let x = seed;
  return new Array<number>(168).fill(0).map(() => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x % 5 === 0 ? x % 5400 : 0;
  });
}

describe("les habitudes d'une grille", () => {
  it("rangent le temps par moments de la journée, la nuit à cheval sur minuit", () => {
    const h = habitsOf(grid([[0, 8, H], [0, 14, H], [5, 20, 2 * H], [6, 23, H], [2, 3, H]]));
    expect(h.measuredSeconds).toBe(6 * H);
    expect(h.dayparts.morning).toBeCloseTo(1 / 6);
    expect(h.dayparts.afternoon).toBeCloseTo(1 / 6);
    expect(h.dayparts.evening).toBeCloseTo(2 / 6);
    expect(h.dayparts.night).toBeCloseTo(2 / 6);
    expect(h.weekendShare).toBeCloseTo(3 / 6);
    expect(h.lateShare).toBeCloseTo(2 / 6);
    expect(h.earlyShare).toBeCloseTo(1 / 6);
  });

  it("font 100 % à elles quatre, et rien sans mesure", () => {
    const h = habitsOf(busyGrid(7));
    const sum = h.dayparts.morning + h.dayparts.afternoon + h.dayparts.evening + h.dayparts.night;
    expect(sum).toBeCloseTo(1, 10);
    expect(habitsOf([])).toEqual({
      measuredSeconds: 0, dayparts: { morning: 0, afternoon: 0, evening: 0, night: 0 }, weekendShare: 0, lateShare: 0, earlyShare: 0,
    });
  });

  it("disent les mêmes parts que la lecture complète du rythme", () => {
    for (const seed of [1, 42, 2026]) {
      const g = busyGrid(seed);
      const full = analyzeRhythm(g);
      const coarse = habitsInsight(habitsOf(g));
      expect(coarse).toEqual({ ...full, topWeekday: null, topHour: null });
    }
  });
});

function stats(g: number[]): ViewingStats {
  return {
    period: "all", timeZone: "Europe/Paris", generatedAt: "", measuredSince: null, hasHistory: true,
    totals: { seconds: 40 * H, measuredSeconds: 40 * H, estimatedSeconds: 0, movies: 0, episodes: 80, series: 2, activeDays: 12 },
    timeline: { unit: "month", buckets: [], undatedSeconds: 0 },
    rhythm: { grid: g },
    split: { movieSeconds: 0, seriesSeconds: 40 * H, animeSeconds: 0 },
    genres: [], languages: [], decades: [], devices: [], topSeries: [], movies: [], moviesOrder: "preference",
    origins: { countries: [], otherShare: 0, unknownShare: 0 },
    listening: { versions: null, versionSeconds: 0, languages: [], otherShare: 0, knownSeconds: 0, since: null },
    people: { actors: [], directors: [] },
    records: { biggestDay: null, longestStreak: null, binge: null, longestSession: null },
    taste: { available: false, computedAt: null, animeShare: 0, loved: [], signals: {
      ratings: 0, ratingAverage: null, superlikes: 0, likes: 0, dislikes: 0, likedPeople: 0, favorites: 0 }, potential: null },
  };
}

describe("les traits de la page publique", () => {
  it("sont ceux de la page du propriétaire, lus sur les habitudes seules", () => {
    const nights = grid([[4, 23, 6 * H], [5, 0, 6 * H], [5, 1, 4 * H], [6, 22, 8 * H], [2, 20, 4 * H]]);
    const owner = viewerBadges(stats(nights), 12);
    const visitor = viewerBadges(stats([]), 12, habitsInsight(habitsOf(nights)));
    expect(visitor).toEqual(owner);
    expect(owner.map((b) => b.key)).toContain("nightOwl");
  });
});

describe("la réponse publique remise à la forme de la page", () => {
  it("ne remplit que des vides : ni grille, ni écran, ni fuseau, ni date de dernière lecture", () => {
    const base = stats(grid([[1, 21, H]]));
    const title = { id: "m1", name: "Heat", kind: "movie" as const, seconds: 2 * H, episodes: 0, viewings: 2, rating: 9, favorite: true,
      verdict: null, year: 1995, anime: false, primaryTag: "tag" };
    const pub: PublicViewingStats = {
      period: "30d", generatedAt: "2026-09-29T10:00:00.000Z", measuredSince: "2026-06-01T12:00:00.000Z", hasHistory: true,
      totals: base.totals, timeline: base.timeline, split: base.split, genres: [], origins: base.origins, decades: [],
      people: base.people, listening: base.listening, habits: habitsOf(base.rhythm.grid),
      topSeries: [], movies: [title], records: base.records,
      taste: { available: false, animeShare: 0, loved: [], signals: base.taste.signals },
    };
    const s = viewingStatsFromPublic(pub);
    expect(s.rhythm.grid).toEqual([]);
    expect(s.devices).toEqual([]);
    expect(s.timeZone).toBe("");
    expect(s.movies[0]).toEqual({ ...title, backdropTag: null, lastPlayedAt: null });
    expect(s.taste.potential).toBeNull();
    expect(s.taste.computedAt).toBeNull();
    expect(s.moviesOrder).toBe("preference");
  });
});
