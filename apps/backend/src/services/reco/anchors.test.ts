import { describe, expect, it } from "vitest";
import {
  ANCHOR_MAX,
  BULK_AGE_DAYS,
  bulkMinutes,
  explicitDecay,
  implicitDecay,
  playAgeDays,
  seriesEngagementByHours,
} from "./anchorSignals";
import { buildAnchors } from "./anchors";
import type { AnchorInputs } from "./anchors";
import type { SignalItem } from "./signals";

const NOW = Date.parse("2026-09-27T12:00:00Z");
const DAY = 86_400_000;
const iso = (daysAgo: number, minute = 0) => new Date(NOW - daysAgo * DAY + minute * 60_000).toISOString();
const HOUR_TICKS = 36_000_000_000;

function movie(id: string, tmdb: number, over: Partial<SignalItem> = {}): SignalItem {
  return { Id: id, Name: `Film ${id}`, Type: "Movie", ProviderIds: { Tmdb: String(tmdb) }, RunTimeTicks: 2 * HOUR_TICKS, ...over };
}

function series(id: string, tmdb: number): SignalItem {
  return { Id: id, Name: `Série ${id}`, Type: "Series", ProviderIds: { Tmdb: String(tmdb) } };
}

function inputs(over: Partial<AnchorInputs> = {}): AnchorInputs {
  return {
    now: NOW,
    ratings: [],
    likes: [],
    feedback: [],
    favorites: [],
    watchlist: [],
    playedMovies: [],
    resumable: [],
    playedEpisodes: [],
    seriesById: new Map(),
    ...over,
  };
}

const byKey = (set: ReturnType<typeof buildAnchors>) => new Map(set.anchors.map((a) => [a.key, a]));

describe("signaux des ancres", () => {
  it("un marquage en masse (quatre titres dans la même minute) ne date rien", () => {
    const stamp = iso(3);
    const bulk = bulkMinutes([stamp, stamp, stamp, stamp, iso(10)]);
    expect(playAgeDays(stamp, bulk, NOW)).toBe(BULK_AGE_DAYS);
    expect(playAgeDays(iso(10), bulk, NOW)).toBeCloseTo(10, 5);
    expect(playAgeDays(null, bulk, NOW)).toBe(BULK_AGE_DAYS);
  });

  it("une série pèse ses HEURES regardées, pas son nombre d'épisodes", () => {
    const shortEpisodes = seriesEngagementByHours(4.3, 128); // 128 épisodes de 2 min
    const longSeries = seriesEngagementByHours(70, 73); // 73 épisodes d'une heure
    expect(longSeries).toBeGreaterThan(shortEpisodes + 0.3);
    expect(seriesEngagementByHours(0.5, 2)).toBe(0);
  });

  it("un goût déclaré décroît moins vite qu'un visionnage, et jamais sous son plancher", () => {
    expect(explicitDecay(365)).toBeGreaterThan(implicitDecay(365));
    expect(explicitDecay(10_000)).toBeGreaterThan(0.5);
    expect(implicitDecay(10_000)).toBeGreaterThan(0.3);
    expect(implicitDecay(0)).toBe(1);
  });
});

describe("construction des ancres", () => {
  it("un revisionnage ne compte pleinement que s'il est mesuré sur deux jours", () => {
    const counted = movie("a", 1, { UserData: { Played: true, PlayCount: 183, LastPlayedDate: iso(5) } });
    const verified = movie("b", 2, { UserData: { Played: true, PlayCount: 2, LastPlayedDate: iso(5, 7) } });
    const set = byKey(buildAnchors(inputs({
      playedMovies: [counted, verified],
      measured: new Map([["b", { fullDays: 2 }]]),
    })));
    expect(set.get("movie:2")!.weight).toBeGreaterThan(set.get("movie:1")!.weight + 0.2);
    expect(set.get("movie:1")!.kinds).toContain("rewatch");
  });

  it("les notes d'une série (saisons) se moyennent, et le poids cumulé est borné", () => {
    const set = byKey(buildAnchors(inputs({
      ratings: [
        { mediaType: "series", tmdbId: 9, score: 10, updatedAt: iso(1) },
        { mediaType: "series", tmdbId: 9, score: 4, updatedAt: iso(1) },
        { mediaType: "movie", tmdbId: 3, score: 10, updatedAt: iso(1) },
      ],
      favorites: [movie("f", 3)],
      playedMovies: [movie("f", 3, { UserData: { Played: true, PlayCount: 5, LastPlayedDate: iso(1) } })],
      measured: new Map([["f", { fullDays: 3 }]]),
    })));
    expect(Math.abs(set.get("tv:9")!.weight)).toBeLessThan(0.3);
    expect(set.get("movie:3")!.weight).toBe(ANCHOR_MAX);
  });

  it("un épisode laissé en plan après cinquante vus n'est pas un abandon ; une série lâchée tôt l'est", () => {
    const followed = series("s1", 11);
    const dropped = series("s2", 12);
    // Dates étalées (un épisode toutes les 30 min) : un vrai visionnage.
    const episodes = Array.from({ length: 50 }, (_, i) => ({ SeriesId: "s1", RunTimeTicks: 0.4 * HOUR_TICKS, UserData: { LastPlayedDate: iso(60, i * 30) } }));
    const pending = (seriesId: string): SignalItem => ({
      Id: `e-${seriesId}`, Type: "Episode", SeriesId: seriesId, RunTimeTicks: HOUR_TICKS,
      UserData: { PlaybackPositionTicks: 0.05 * HOUR_TICKS, LastPlayedDate: iso(45) },
    });
    const set = byKey(buildAnchors(inputs({
      playedEpisodes: [...episodes, { SeriesId: "s2", RunTimeTicks: HOUR_TICKS, UserData: { LastPlayedDate: iso(50) } }],
      seriesById: new Map([["s1", followed], ["s2", dropped]]),
      resumable: [pending("s1"), pending("s2")],
    })));
    expect(set.get("tv:11")!.weight).toBeGreaterThan(0.5);
    expect(set.get("tv:11")!.kinds).not.toContain("abandon");
    expect(set.get("tv:12")!.weight).toBeLessThan(0);
  });

  it("« ne plus me proposer » devient une ancre négative", () => {
    const set = byKey(buildAnchors(inputs({
      feedback: [
        { itemKey: "movie:77", action: "dismissed", createdAt: iso(2) },
        { itemKey: "movie:78", action: "already_seen", createdAt: iso(2) },
      ],
    })));
    expect(set.get("movie:77")!.weight).toBeLessThan(0);
    expect(set.get("movie:77")!.kinds).toEqual(["dismissed"]);
    expect(set.has("movie:78")).toBe(false);
  });

  it("un titre sans identité TMDB garde une ancre sur sa fiche Jellyfin", () => {
    const set = buildAnchors(inputs({ favorites: [{ Id: "x1", Name: "Animé AniDB", Type: "Series", ProviderIds: { AniDB: "5" } }] }));
    expect(set.anchors[0].key).toBe("jf:x1");
    expect(set.itemByKey.get("jf:x1")?.Name).toBe("Animé AniDB");
  });

  it("le marquage en masse d'une saison la classe comme ancienne", () => {
    const stamp = iso(1);
    const s = series("s3", 13);
    const eps = Array.from({ length: 10 }, () => ({ SeriesId: "s3", RunTimeTicks: HOUR_TICKS, UserData: { LastPlayedDate: stamp } }));
    const bulk = byKey(buildAnchors(inputs({ playedEpisodes: eps, seriesById: new Map([["s3", s]]) }))).get("tv:13")!;
    const real = eps.map((e, i) => ({ ...e, UserData: { LastPlayedDate: iso(1, i * 60) } }));
    const watched = byKey(buildAnchors(inputs({ playedEpisodes: real, seriesById: new Map([["s3", s]]) }))).get("tv:13")!;
    expect(watched.weight).toBeGreaterThan(bulk.weight);
    expect(bulk.lastAt).toBeNull();
  });
});
