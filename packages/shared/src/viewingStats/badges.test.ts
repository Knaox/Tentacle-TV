import { describe, expect, it } from "vitest";
import type { ViewingStats } from "../types/viewingStats";
import { viewerBadges } from "./badges";

/**
 * Les traits se gagnent à la DURÉE réelle et sur ce qu'on entend vraiment —
 * jamais sur un compte d'épisodes, jamais sur la langue originale des titres.
 */

const H = 3600;

function stats(over: Partial<ViewingStats> = {}): ViewingStats {
  return {
    period: "all", timeZone: "Europe/Paris", generatedAt: "", measuredSince: null, hasHistory: true,
    totals: { seconds: 20 * H, measuredSeconds: 20 * H, estimatedSeconds: 0, movies: 0, episodes: 80, series: 2, activeDays: 5 },
    timeline: { unit: "month", buckets: [], undatedSeconds: 0 },
    rhythm: { grid: new Array<number>(168).fill(0) },
    split: { movieSeconds: 0, seriesSeconds: 0, animeSeconds: 0 },
    genres: [], languages: [], decades: [], devices: [], topSeries: [], movies: [], moviesOrder: "preference",
    origins: { countries: [], otherShare: 0, unknownShare: 0 },
    listening: { versions: null, versionSeconds: 0, languages: [], otherShare: 0, knownSeconds: 0, since: null },
    people: { actors: [], directors: [] },
    records: { biggestDay: null, longestStreak: null, binge: null, longestSession: null },
    taste: { available: false, computedAt: null, animeShare: 0, loved: [], signals: {
      ratings: 0, ratingAverage: null, superlikes: 0, likes: 0, dislikes: 0, likedPeople: 0, favorites: 0 } },
    ...over,
  };
}

const binge = (episodes: number, seconds: number) =>
  ({ biggestDay: null, longestStreak: null, longestSession: null, binge: { seriesId: "s", seriesName: "Les Kassos", episodes, seconds, date: "" } });
const keys = (s: ViewingStats) => viewerBadges(s, 12).map((b) => b.key);
const share = (key: string, value: number) => ({ key, label: key, seconds: value * 20 * H, share: value });

describe("le marathonien", () => {
  it("ne l'est pas pour vingt épisodes de trois minutes", () => {
    expect(keys(stats({ records: binge(20, H) }))).not.toContain("binger");
  });

  it("l'est pour trois heures d'une même série dans la journée, durée à l'appui", () => {
    const badge = viewerBadges(stats({ records: binge(4, 3.5 * H) }), 12).find((b) => b.key === "binger");
    expect(badge).toMatchObject({ seconds: 3.5 * H, label: "Les Kassos" });
  });
});

describe("le polyglotte et le globe-trotteur", () => {
  it("ne naissent plus de la langue ORIGINALE des titres", () => {
    const legacy = stats({ languages: [share("en", 0.5), share("de", 0.2), share("ko", 0.15)] });
    expect(keys(legacy)).not.toContain("polyglot");
  });

  it("le polyglotte se lit sur les langues ENTENDUES", () => {
    const listening = { ...stats().listening, knownSeconds: 20 * H, languages: [share("fr", 0.6), share("en", 0.25), share("ja", 0.15)] };
    expect(keys(stats({ listening }))).toContain("polyglot");
    const french = { ...listening, languages: [share("fr", 0.95), share("ja", 0.05)] };
    expect(keys(stats({ listening: french }))).not.toContain("polyglot");
  });

  it("le globe-trotteur se lit sur les pays d'origine, quatre au moins à 10 %", () => {
    const origins = { countries: [share("US", 0.4), share("JP", 0.25), share("FR", 0.15), share("DE", 0.12)], otherShare: 0.08, unknownShare: 0 };
    expect(viewerBadges(stats({ origins }), 12).find((b) => b.key === "worldly")).toMatchObject({ count: 4 });
    expect(keys(stats({ origins: { ...origins, countries: origins.countries.slice(0, 3) } }))).not.toContain("worldly");
  });
});
