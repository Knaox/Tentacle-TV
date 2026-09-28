import { describe, expect, it } from "vitest";
import { computePeriod } from "./computePeriod";
import { H, NOW, cal, dataset, played, seg, title } from "../../../test/viewingStatsFixtures";

describe("le raccord mesuré / estimé", () => {
  it("estime ce qui a été vu avant la mesure, mesure ce qui a été vu après, sans double compte", () => {
    const data = dataset(
      [title("dune", "movie"), title("heat", "movie")],
      [played("dune", "movie", 2 * H, "2026-06-01T20:00:00Z"), played("heat", "movie", 3 * H, "2026-09-20T22:00:00Z")],
      [seg("heat", "movie", "2026-09-20T19:00:00Z", 2.5 * H)]
    );
    const all = computePeriod(data, "all", cal(), NOW);
    expect(all.totals.estimatedSeconds).toBe(2 * H);
    expect(all.totals.measuredSeconds).toBe(2.5 * H);
    expect(all.totals.seconds).toBe(4.5 * H);
    expect(all.totals.movies).toBe(2);
  });

  it("sans aucune mesure, tout est estimé — comme le classement", () => {
    const data = dataset([title("dune", "movie")], [played("dune", "movie", 2 * H, "2026-09-20T20:00:00Z")], [], null);
    expect(computePeriod(data, "all", cal(), NOW).totals).toMatchObject({ seconds: 2 * H, estimatedSeconds: 2 * H });
  });
});

describe("les périodes", () => {
  const data = () =>
    dataset(
      [title("dune", "movie"), title("lost", "series"), title("heat", "movie")],
      [
        played("dune", "movie", 2 * H, "2025-11-02T20:00:00Z"),
        played("lost", "episode", H, "2026-02-10T20:00:00Z", "e1"),
        played("heat", "movie", 3 * H, null),
      ],
      [seg("lost", "episode", "2026-09-27T19:00:00Z", 0.75 * H, { itemId: "e2" })]
    );

  it("« 30 jours » ne garde que les 30 derniers jours locaux", () => {
    const p = computePeriod(data(), "30d", cal(), NOW);
    expect(p.totals).toMatchObject({ seconds: 0.75 * H, movies: 0, episodes: 0, series: 1 });
    expect(p.timeline.unit).toBe("day");
    expect(p.timeline.buckets).toHaveLength(30);
    expect(p.timeline.buckets[29]).toEqual({ key: "2026-09-28", measuredSeconds: 0, estimatedSeconds: 0 });
    expect(p.timeline.buckets[28].measuredSeconds).toBe(0.75 * H);
  });

  it("« cette année » part du 1er janvier local, mois par mois jusqu'au mois courant", () => {
    const p = computePeriod(data(), "year", cal(), NOW);
    expect(p.totals).toMatchObject({ seconds: 1.75 * H, episodes: 1, movies: 0 });
    expect(p.timeline.buckets.map((b) => b.key)).toEqual(
      ["01", "02", "03", "04", "05", "06", "07", "08", "09"].map((m) => `2026-${m}`)
    );
    expect(p.timeline.buckets[1].estimatedSeconds).toBe(H);
  });

  it("« tout » compte aussi l'estimé sans date, hors de la frise", () => {
    const p = computePeriod(data(), "all", cal(), NOW);
    expect(p.totals.seconds).toBe((2 + 1 + 3 + 0.75) * H);
    expect(p.timeline.undatedSeconds).toBe(3 * H);
    expect(p.timeline.buckets[0].key).toBe("2025-11");
    const inBuckets = p.timeline.buckets.reduce((n, b) => n + b.measuredSeconds + b.estimatedSeconds, 0);
    expect(inBuckets + p.timeline.undatedSeconds).toBe(p.totals.seconds);
  });

  it("passe à l'année quand l'historique dépasse deux ans", () => {
    const d = dataset([title("old", "movie")], [played("old", "movie", 2 * H, "2021-05-01T20:00:00Z")]);
    const p = computePeriod(d, "all", cal(), NOW);
    expect(p.timeline.unit).toBe("year");
    expect(p.timeline.buckets.map((b) => b.key)).toEqual(["2021", "2022", "2023", "2024", "2025", "2026"]);
  });
});

describe("le marquage en masse", () => {
  it("compte les titres marqués « vus » d'un coup dans « tout », jamais dans une période datée", () => {
    // Avant la première mesure : estimé dans « tout ».
    const at = "2026-06-10T20:00:10Z";
    const entries = [1, 2, 3, 4].map((n) => played("lost", "episode", H, at, `e${n}`));
    const data = dataset([title("lost", "series")], entries);
    expect(computePeriod(data, "all", cal(), NOW).totals).toMatchObject({ episodes: 4, seconds: 4 * H });
    expect(computePeriod(data, "30d", cal(), NOW).totals).toMatchObject({ episodes: 0, seconds: 0 });
    expect(computePeriod(data, "all", cal(), NOW).records.binge).toBeNull();
  });
});

describe("les films revus", () => {
  it("ne dit « revu » que sur deux jours distincts à 60 % ou plus, mesurés", () => {
    const opts = { runtimeSeconds: 2 * H };
    const data = dataset(
      [title("dune", "movie")],
      [played("dune", "movie", 2 * H, "2026-09-26T21:00:00Z")],
      [
        seg("dune", "movie", "2026-09-12T18:00:00Z", 1.5 * H, opts),
        seg("dune", "movie", "2026-09-19T18:00:00Z", 0.5 * H, opts),
        seg("dune", "movie", "2026-09-26T19:00:00Z", 1.9 * H, opts),
      ]
    );
    const [movie] = computePeriod(data, "all", cal(), NOW).movies;
    expect(movie).toMatchObject({ id: "dune", viewings: 2, seconds: Math.round(3.9 * H) });
  });
});

describe("le rythme", () => {
  it("répartit une séance sur les heures locales qu'elle traverse", () => {
    // 18:40 → 20:10 UTC = 20:40 → 22:10 à Paris, le vendredi 25/09.
    const s = seg("lost", "episode", "2026-09-25T18:40:00Z", 90 * 60);
    const data = dataset([title("lost", "series")], [], [s]);
    const grid = computePeriod(data, "all", cal(), NOW).rhythm.grid;
    const friday = 4 * 24;
    expect(grid[friday + 20]).toBe(20 * 60);
    expect(grid[friday + 21]).toBe(60 * 60);
    expect(grid[friday + 22]).toBe(10 * 60);
    expect(grid.reduce((a, b) => a + b, 0)).toBe(90 * 60);
  });

  it("pose d'un seul tenant une séance restée surtout en pause", () => {
    const s = seg("lost", "episode", "2026-09-25T18:00:00Z", 30 * 60, { lastSeenAt: Date.parse("2026-09-26T02:00:00Z") });
    const grid = computePeriod(dataset([title("lost", "series")], [], [s]), "all", cal(), NOW).rhythm.grid;
    expect(grid[4 * 24 + 20]).toBe(30 * 60);
  });
});

describe("les répartitions", () => {
  it("compte un titre dans chacun de ses genres, et sépare les animés", () => {
    const data = dataset(
      [
        title("dune", "movie", { genreIds: [878, 12], origin: "US", originalLanguage: "en" }),
        title("aot", "series", { genreIds: [16, 10759], origin: "JP", originalLanguage: "ja", anime: true }),
      ],
      [played("dune", "movie", 3 * H, "2026-07-01T20:00:00Z"), played("aot", "episode", H, "2026-07-02T20:00:00Z", "a1")]
    );
    const p = computePeriod(data, "all", cal(), NOW);
    expect(p.genres.map((g) => g.key)).toEqual(["12", "878", "10759", "16"]);
    expect(p.genres[0].share).toBeCloseTo(0.75);
    expect(p.origins.countries.map((c) => c.key)).toEqual(["US", "JP"]);
    expect(p.split).toEqual({ movieSeconds: 3 * H, seriesSeconds: 0, animeSeconds: H });
    expect(p.decades).toEqual([{ decade: 2010, seconds: 4 * H }]);
  });

  it("varie les visages : deux au plus par titre dominant", () => {
    const cast = [1, 2, 3, 4].map((id) => ({ id, name: `acteur ${id}` }));
    const data = dataset(
      [title("lost", "series", { cast }), title("dune", "movie", { cast: [{ id: 9, name: "neuf" }] })],
      [played("lost", "episode", 10 * H, "2026-07-01T20:00:00Z", "l1"), played("dune", "movie", 2 * H, "2026-07-02T20:00:00Z")]
    );
    const actors = computePeriod(data, "all", cal(), NOW).people.actors;
    expect(actors.map((a) => a.tmdbId)).toEqual([1, 2, 9]);
  });
});
