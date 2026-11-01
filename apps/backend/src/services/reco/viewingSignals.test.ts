import { describe, expect, it } from "vitest";
import { ANCHOR_ABANDON, ANCHOR_COMPLETED, implicitDecay } from "./anchorSignals";
import { buildAnchors } from "./anchors";
import type { AnchorInputs, PlayedEpisode } from "./anchors";
import type { SignalItem } from "./signals";
import { classifyResume, seriesViewings } from "./viewingSignals";

const NOW = Date.parse("2026-11-01T12:00:00Z");
const DAY = 86_400_000;
const HOUR = 36_000_000_000;
const iso = (daysAgo: number, minute = 0) => new Date(NOW - daysAgo * DAY + minute * 60_000).toISOString();

const movie = (id: string, tmdb: number, progress: number, daysAgo: number): SignalItem => ({
  Id: id, Name: `Film ${id}`, Type: "Movie", ProviderIds: { Tmdb: String(tmdb) }, RunTimeTicks: 2 * HOUR,
  UserData: { PlaybackPositionTicks: 2 * HOUR * progress, LastPlayedDate: iso(daysAgo) },
});
const series = (id: string, tmdb: number, episodes?: number): SignalItem => ({
  Id: id, Name: `Série ${id}`, Type: "Series", ProviderIds: { Tmdb: String(tmdb) }, RecursiveItemCount: episodes,
});
const resumedEpisode = (seriesId: string, n: number, progress: number, daysAgo: number): SignalItem => ({
  Id: `${seriesId}-r${n}`, Type: "Episode", SeriesId: seriesId, RunTimeTicks: 0.5 * HOUR,
  UserData: { PlaybackPositionTicks: 0.5 * HOUR * progress, LastPlayedDate: iso(daysAgo, n * 40) },
});
const played = (seriesId: string, count: number, daysAgo: number): PlayedEpisode[] =>
  Array.from({ length: count }, (_, i) => ({ SeriesId: seriesId, RunTimeTicks: 0.5 * HOUR, UserData: { LastPlayedDate: iso(daysAgo, i * 40) } }));

function build(over: Partial<AnchorInputs>) {
  const set = buildAnchors({
    now: NOW, ratings: [], likes: [], feedback: [], favorites: [], playedMovies: [], resumable: [],
    playedEpisodes: [], seriesById: new Map(), ...over,
  });
  return { set, byKey: new Map(set.anchors.map((a) => [a.key, a])) };
}

describe("éléments entamés", () => {
  it("classe la position : générique, partiel, vrai départ, simple ouverture", () => {
    expect(classifyResume(movie("a", 1, 0.85, 1)).kind).toBe("watched");
    expect(classifyResume(movie("a", 1, 0.6, 1)).kind).toBe("partial");
    expect(classifyResume(movie("a", 1, 0.1, 1)).kind).toBe("started");
    // 1 % d'un film de deux heures : 72 secondes, ni 5 minutes ni 5 %.
    expect(classifyResume(movie("a", 1, 0.01, 1)).kind).toBe("none");
  });

  it("un film arrêté au générique (85 %) compte VU, comme un film marqué vu", () => {
    const { byKey } = build({ resumable: [movie("a", 1, 0.85, 10)] });
    const ref = build({ playedMovies: [{ ...movie("b", 1, 0, 10), UserData: { Played: true, LastPlayedDate: iso(10) } }] }).byKey;
    expect(byKey.get("movie:1")!.kinds).toEqual(["completed"]);
    expect(byKey.get("movie:1")!.weight).toBeCloseTo(ref.get("movie:1")!.weight, 5);
  });

  it("un film vu à 60 % pèse une part du « vu », au prorata", () => {
    const { byKey } = build({ resumable: [movie("a", 1, 0.6, 0)] });
    expect(byKey.get("movie:1")!.kinds).toEqual(["partial"]);
    expect(byKey.get("movie:1")!.weight).toBeCloseTo(ANCHOR_COMPLETED * 0.6, 5);
    expect(byKey.get("movie:1")!.hours).toBeCloseTo(1.2, 1);
  });

  it("un film ouvert à 1 % n'est ni un abandon ni un goût", () => {
    const { byKey } = build({ resumable: [movie("a", 1, 0.01, 90)] });
    expect(byKey.has("movie:1")).toBe(false);
  });

  it("un film quitté à 10 % depuis un mois et demi est UN abandon", () => {
    const { byKey } = build({ resumable: [movie("a", 1, 0.1, 45)] });
    expect(byKey.get("movie:1")!.kinds).toEqual(["abandon"]);
    expect(byKey.get("movie:1")!.weight).toBeCloseTo(ANCHOR_ABANDON * implicitDecay(45), 2);
  });

  it("des épisodes arrêtés à 91 % complètent la série : 2 vus + 3 entamés = suivie", () => {
    const { byKey } = build({
      playedEpisodes: played("s", 2, 20),
      resumable: [1, 2, 3].map((n) => resumedEpisode("s", n, 0.91, 19)),
      seriesById: new Map([["s", series("s", 7, 10)]]),
    });
    expect(byKey.get("tv:7")!.kinds).toEqual(["series"]);
    expect(byKey.get("tv:7")!.weight).toBeGreaterThan(0.4);
  });
});

describe("abandons", () => {
  it("quatre épisodes OUVERTS (0-1 %) ne font aucun abandon", () => {
    const { byKey } = build({
      resumable: [1, 2, 3, 4].map((n) => resumedEpisode("s", n, 0.005, 60)),
      seriesById: new Map([["s", series("s", 7, 24)]]),
    });
    expect(byKey.has("tv:7")).toBe(false);
  });

  it("plusieurs épisodes lâchés ne font qu'UN abandon par série", () => {
    const { byKey } = build({
      resumable: [1, 2, 3].map((n) => resumedEpisode("s", n, 0.15, 60 - n)),
      seriesById: new Map([["s", series("s", 7, 24)]]),
    });
    const a = byKey.get("tv:7")!;
    expect(a.kinds).toEqual(["abandon"]);
    expect(a.weight).toBeGreaterThan(ANCHOR_ABANDON - 0.01);
  });

  it("un épisode lâché puis la série reprise ensuite n'est pas un abandon", () => {
    const { byKey } = build({
      playedEpisodes: played("s", 2, 40),
      resumable: [resumedEpisode("s", 1, 0.15, 60)],
      seriesById: new Map([["s", series("s", 7, 24)]]),
    });
    expect(byKey.get("tv:7")?.kinds ?? []).not.toContain("abandon");
  });
});

describe("série longue lâchée tôt", () => {
  const longOne = new Map([["s", series("s", 7, 1100)]]);

  it("six épisodes d'un fleuve, plus rien depuis deux mois : tiède, jugée, sans ancre", () => {
    const { set, byKey } = build({ playedEpisodes: played("s", 6, 60), seriesById: longOne });
    expect(byKey.has("tv:7")).toBe(false);
    expect(set.judged.has("tv:7")).toBe(true);
  });

  it("les mêmes six épisodes regardés cette semaine : un goût en cours", () => {
    const { byKey } = build({ playedEpisodes: played("s", 6, 3), seriesById: longOne });
    expect(byKey.get("tv:7")!.weight).toBeGreaterThan(0.4);
  });

  it("une série courte n'est jamais « lâchée tôt »", () => {
    const { byKey } = build({ playedEpisodes: played("s", 6, 60), seriesById: new Map([["s", series("s", 7, 10)]]) });
    expect(byKey.get("tv:7")!.weight).toBeGreaterThan(0.2);
  });
});

describe("visionnage d'une série", () => {
  it("mesure le plus d'heures regardées en quatorze jours", () => {
    const eps = [...played("s", 20, 40), ...played("s", 4, 2)];
    const view = seriesViewings(eps, [], new Set(), NOW).get("s")!;
    expect(view.episodes).toBe(24);
    expect(view.peakHours).toBeCloseTo(10, 5);
  });
});
