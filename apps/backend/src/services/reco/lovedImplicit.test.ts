import { describe, expect, it } from "vitest";
import { ANCHOR_COMPLETED, ANCHOR_FAVORITE } from "./anchorSignals";
import { buildAnchors } from "./anchors";
import type { AnchorInputs, PlayedEpisode } from "./anchors";
import { isLoved } from "./lovedTaste";
import type { SignalItem } from "./signals";

const NOW = Date.parse("2026-11-01T12:00:00Z");
const DAY = 86_400_000;
const HOUR = 36_000_000_000;
const iso = (daysAgo: number, minute = 0) => new Date(NOW - daysAgo * DAY + minute * 60_000).toISOString();

const playedMovie = (id: string, tmdb: number, daysAgo: number): SignalItem => ({
  Id: id, Name: `Film ${id}`, Type: "Movie", ProviderIds: { Tmdb: String(tmdb) }, RunTimeTicks: 2 * HOUR,
  UserData: { Played: true, PlayCount: 1, LastPlayedDate: iso(daysAgo) },
});
const series = (id: string, tmdb: number, episodes: number): SignalItem => ({
  Id: id, Name: `Série ${id}`, Type: "Series", ProviderIds: { Tmdb: String(tmdb) }, RecursiveItemCount: episodes,
});
/** `count` épisodes d'une heure, un tous les `everyDays` jours, le dernier il y a `daysAgo` jours. */
const episodes = (seriesId: string, count: number, daysAgo: number, everyDays: number): PlayedEpisode[] =>
  Array.from({ length: count }, (_, i) => ({
    SeriesId: seriesId, RunTimeTicks: HOUR, UserData: { LastPlayedDate: iso(daysAgo + (count - 1 - i) * everyDays, i) },
  }));

function anchorsOf(over: Partial<AnchorInputs>) {
  const set = buildAnchors({
    now: NOW, ratings: [], likes: [], feedback: [], favorites: [], playedMovies: [], resumable: [],
    playedEpisodes: [], seriesById: new Map(), ...over,
  });
  return new Map(set.anchors.map((a) => [a.key, a]));
}

describe("rééquilibrage : le visionnage pèse, le cœur départage", () => {
  it("un film vu en entier pèse à peu près un cœur", () => {
    expect(Math.abs(ANCHOR_COMPLETED - ANCHOR_FAVORITE)).toBeLessThanOrEqual(0.15);
    const watched = anchorsOf({ playedMovies: [playedMovie("a", 1, 5)] }).get("movie:1")!;
    const hearted = anchorsOf({ playedMovies: [playedMovie("a", 1, 5)], favorites: [playedMovie("a", 1, 5)] }).get("movie:1")!;
    expect(hearted.weight).toBeGreaterThan(watched.weight);
    expect(watched.weight).toBeGreaterThan(hearted.weight / 2.5);
  });
});

describe("adoré sans aucun geste", () => {
  it("une série finie (ou presque) est adorée", () => {
    const a = anchorsOf({ playedEpisodes: episodes("s", 22, 30, 3), seriesById: new Map([["s", series("s", 5, 24)]]) }).get("tv:5")!;
    expect(a.traits).toContain("finished");
    expect(isLoved(a)).toBe(true);
  });

  it("une série dévorée (douze heures en une semaine) est adorée, même loin de sa fin", () => {
    const a = anchorsOf({ playedEpisodes: episodes("s", 12, 2, 0.5), seriesById: new Map([["s", series("s", 5, 100)]]) }).get("tv:5")!;
    expect(a.traits).toEqual(["devoured"]);
    expect(isLoved(a)).toBe(true);
  });

  it("une série suivie au compte-gouttes, loin de sa fin, n'est pas adorée", () => {
    const a = anchorsOf({ playedEpisodes: episodes("s", 8, 2, 7), seriesById: new Map([["s", series("s", 5, 40)]]) }).get("tv:5")!;
    expect(a.weight).toBeGreaterThan(0);
    expect(isLoved(a)).toBe(false);
  });

  it("un film revu (mesuré sur deux jours) est adoré ; un compteur seul, non", () => {
    const m = { ...playedMovie("a", 1, 200), UserData: { Played: true, PlayCount: 3, LastPlayedDate: iso(200) } };
    expect(isLoved(anchorsOf({ playedMovies: [m], measured: new Map([["a", { fullDays: 2 }]]) }).get("movie:1")!)).toBe(true);
    expect(isLoved(anchorsOf({ playedMovies: [m] }).get("movie:1")!)).toBe(false);
  });

  it("un film fini d'une traite il y a peu est adoré ; vu il y a un an, il reste « vu »", () => {
    const measured = new Map([["a", { fullDays: 1 }]]);
    expect(isLoved(anchorsOf({ playedMovies: [playedMovie("a", 1, 10)], measured }).get("movie:1")!)).toBe(true);
    expect(isLoved(anchorsOf({ playedMovies: [playedMovie("a", 1, 400)], measured }).get("movie:1")!)).toBe(false);
    expect(isLoved(anchorsOf({ playedMovies: [playedMovie("a", 1, 10)] }).get("movie:1")!)).toBe(false);
  });

  it("un trait ne rachète pas un refus", () => {
    const a = anchorsOf({
      playedEpisodes: episodes("s", 22, 30, 3), seriesById: new Map([["s", series("s", 5, 24)]]),
      feedback: [{ itemKey: "tv:5", action: "dismissed", createdAt: iso(1) }],
      swipes: [{ mediaType: "tv", tmdbId: 5, verdict: "dislike", updatedAt: iso(1) }],
    }).get("tv:5")!;
    expect(a.weight).toBeLessThan(0);
    expect(isLoved(a)).toBe(false);
  });
});
