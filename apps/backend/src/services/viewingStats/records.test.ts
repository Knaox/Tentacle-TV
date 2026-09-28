import { describe, expect, it } from "vitest";
import { computePeriod } from "./computePeriod";
import { foldJudgments } from "./judgments";
import { NOW, cal, dataset, seg, title } from "../../../test/viewingStatsFixtures";

/**
 * Les records se jugent à la durée réelle : vingt épisodes de trois minutes
 * font une heure, pas un marathon de vingt épisodes.
 */

const short = (i: number, day: string) =>
  seg("kassos", "episode", `${day}T19:${String(i * 3).padStart(2, "0")}:00Z`, 180, { itemId: `k${i}`, runtimeSeconds: 180 });
const long = (i: number, day: string) =>
  seg("lost", "episode", `${day}T${14 + i}:00:00Z`, 50 * 60, { itemId: `l${i}`, runtimeSeconds: 50 * 60 });

describe("le marathon", () => {
  it("retient le plus de TEMPS sur une série en un jour, pas le plus d'épisodes", () => {
    const data = dataset([title("kassos", "series"), title("lost", "series")], [], [
      ...Array.from({ length: 20 }, (_, i) => short(i, "2026-09-20")),
      ...Array.from({ length: 3 }, (_, i) => long(i, "2026-09-21")),
    ]);
    expect(computePeriod(data, "all", cal(), NOW).records.binge).toEqual({
      seriesId: "lost", seriesName: "lost", episodes: 3, seconds: 150 * 60, date: "2026-09-21",
    });
  });

  it("ne voit pas de marathon sous une heure, quel que soit le nombre d'épisodes", () => {
    const data = dataset([title("kassos", "series")], [], Array.from({ length: 12 }, (_, i) => short(i, "2026-09-20")));
    expect(computePeriod(data, "all", cal(), NOW).records.binge).toBeNull();
  });
});

describe("la série de jours d'affilée", () => {
  const daily = (minutes: number) =>
    ["2026-09-20", "2026-09-21", "2026-09-22"].map((d) => seg("lost", "episode", `${d}T19:00:00Z`, minutes * 60, { itemId: d }));

  it("ne compte que les journées d'un quart d'heure au moins", () => {
    const light = computePeriod(dataset([title("lost", "series")], [], daily(5)), "all", cal(), NOW);
    expect(light.records.longestStreak).toBeNull();
    expect(light.totals.activeDays).toBe(3);
    const steady = computePeriod(dataset([title("lost", "series")], [], daily(20)), "all", cal(), NOW);
    expect(steady.records.longestStreak).toEqual({ days: 3, from: "2026-09-20", to: "2026-09-22" });
  });
});

describe("les jugements", () => {
  it("fondent les notes d'une série, et le verdict d'« Affiner » passe devant un « J'aime »", () => {
    const { judgments, counts } = foldJudgments(
      [
        { mediaType: "series", tmdbId: 1399, score: 8 },
        { mediaType: "episode", tmdbId: 1399, score: 10 },
        { mediaType: "movie", tmdbId: 603, score: 7 },
      ],
      [
        { mediaType: "movie", tmdbId: 603, verdict: "superlike" },
        { mediaType: "tv", tmdbId: 66732, verdict: "skip" },
      ],
      [{ mediaType: "movie", tmdbId: 603 }, { mediaType: "series", tmdbId: 94605 }],
      2,
      new Set(["jf-1"])
    );
    expect(judgments.ratings).toEqual(new Map([["tv:1399", 9], ["movie:603", 7]]));
    expect(judgments.verdicts).toEqual(new Map([["movie:603", "superlike"], ["tv:94605", "like"]]));
    expect(counts).toEqual({ ratings: 3, ratingAverage: 8.3, superlikes: 1, likes: 2, dislikes: 0, likedPeople: 2 });
    expect(judgments.favorites.has("jf-1")).toBe(true);
  });
});
