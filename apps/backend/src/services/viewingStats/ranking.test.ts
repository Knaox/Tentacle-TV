import { describe, expect, it } from "vitest";
import { computePeriod } from "./computePeriod";
import { preferenceScore } from "./movieRanking";
import { H, NOW, cal, dataset, noJudgments, played, seg, title } from "../../../test/viewingStatsFixtures";

/**
 * Les classements dits en clair : le film préféré (note, coup de cœur,
 * favori, revisionnages, puis le temps) et les visages (titres distincts,
 * puis le temps).
 */

describe("le film préféré", () => {
  const movies = [
    title("heat", "movie", { tmdbId: 949 }),
    title("dune", "movie", { tmdbId: 438631 }),
    title("matrix", "movie", { tmdbId: 603 }),
    title("cars", "movie", { tmdbId: 920 }),
    title("avatar", "movie", { tmdbId: 19995 }),
  ];
  const opts = { runtimeSeconds: 2 * H };
  const judged = () => {
    const judgments = noJudgments();
    judgments.ratings.set("movie:949", 9);
    judgments.ratings.set("movie:19995", 3);
    judgments.verdicts.set("movie:438631", "superlike");
    judgments.favorites.add("dune");
    return dataset(
      movies,
      [
        played("heat", "movie", 2 * H, "2026-06-01T20:00:00Z"),
        played("dune", "movie", 2 * H, "2026-06-02T20:00:00Z"),
        played("cars", "movie", 4 * H, "2026-06-03T20:00:00Z"),
        played("avatar", "movie", 3 * H, "2026-06-04T20:00:00Z"),
        played("matrix", "movie", 2 * H, "2026-09-20T22:00:00Z"),
      ],
      ["2026-09-06", "2026-09-13", "2026-09-20"].map((d) => seg("matrix", "movie", `${d}T20:00:00Z`, 1.8 * H, opts)),
      undefined,
      judgments
    );
  };

  it("classe par les avis donnés, jamais par la date", () => {
    const list = computePeriod(judged(), "all", cal(), NOW).movies;
    expect(list.map((m) => m.id)).toEqual(["dune", "heat", "matrix", "cars", "avatar"]);
    expect(list[0]).toMatchObject({ favorite: true, verdict: "superlike", rating: null, viewings: 1 });
    expect(list[1]).toMatchObject({ rating: 9, favorite: false, verdict: null });
  });

  it("compte chaque visionnage : un de plus que zéro dès « vu », autant que de jours vus à 60 %", () => {
    const list = computePeriod(judged(), "all", cal(), NOW).movies;
    expect(list.find((m) => m.id === "cars")?.viewings).toBe(1);
    expect(list.find((m) => m.id === "matrix")?.viewings).toBe(3);
  });

  it("pèse les critères dans l'ordre annoncé", () => {
    const base = { rating: null, verdict: null, favorite: false, viewings: 1 } as const;
    expect(preferenceScore({ ...base, rating: 10 })).toBe(10);
    expect(preferenceScore({ ...base, rating: 5 })).toBe(0);
    expect(preferenceScore({ ...base, rating: 1 })).toBe(-8);
    expect(preferenceScore({ ...base, verdict: "superlike", favorite: true })).toBe(10);
    expect(preferenceScore({ ...base, viewings: 9 })).toBe(6);
    expect(preferenceScore({ ...base, verdict: "dislike" })).toBe(-6);
  });

  it("départage deux films sans avis par le temps passé", () => {
    const data = dataset([title("a", "movie"), title("b", "movie")], [
      played("a", "movie", 1.5 * H, "2026-09-10T20:00:00Z"),
      played("b", "movie", 3 * H, "2026-06-10T20:00:00Z"),
    ]);
    expect(computePeriod(data, "all", cal(), NOW).movies.map((m) => m.id)).toEqual(["b", "a"]);
  });
});

describe("les acteurs préférés", () => {
  const actor = (id: number) => ({ id, name: `acteur ${id}` });

  it("comptent d'abord les titres distincts — une série de quinze saisons compte pour un", () => {
    const episodes = Array.from({ length: 150 }, (_, i) => played("lost", "episode", 0.75 * H, "2026-07-01T20:00:00Z", `e${i}`));
    for (const [i, e] of episodes.entries()) e.lastPlayedAt = Date.parse("2026-05-01T20:00:00Z") + i * 86_400_000;
    const data = dataset(
      [
        title("lost", "series", { cast: [actor(1)] }),
        title("heat", "movie", { cast: [actor(2)] }),
        title("ronin", "movie", { cast: [actor(2)] }),
        title("casino", "movie", { cast: [actor(2)] }),
      ],
      [
        ...episodes,
        played("heat", "movie", 2.5 * H, "2026-06-01T20:00:00Z"),
        played("ronin", "movie", 2 * H, "2026-06-02T20:00:00Z"),
        played("casino", "movie", 3 * H, "2026-06-03T20:00:00Z"),
      ]
    );
    const actors = computePeriod(data, "all", cal(), NOW).people.actors;
    expect(actors.map((a) => [a.tmdbId, a.titles])).toEqual([[2, 3], [1, 1]]);
    expect(actors[1].seconds).toBeGreaterThan(actors[0].seconds);
  });

  it("départagent au temps passé à titres égaux, et ignorent une lecture d'essai", () => {
    const data = dataset(
      [
        title("heat", "movie", { cast: [actor(1), actor(2)] }),
        title("ronin", "movie", { cast: [actor(1)] }),
        title("fargo", "movie", { cast: [actor(2)] }),
        title("teaser", "movie", { cast: [actor(3)] }),
      ],
      [
        played("heat", "movie", 2 * H, "2026-06-01T20:00:00Z"),
        played("ronin", "movie", H, "2026-06-02T20:00:00Z"),
        played("fargo", "movie", 3 * H, "2026-06-03T20:00:00Z"),
      ],
      [seg("teaser", "movie", "2026-09-20T20:00:00Z", 2)]
    );
    const actors = computePeriod(data, "all", cal(), NOW).people.actors;
    expect(actors.map((a) => a.tmdbId)).toEqual([2, 1]);
  });
});
