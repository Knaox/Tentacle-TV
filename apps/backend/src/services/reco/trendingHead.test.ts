import { describe, expect, it } from "vitest";
import { trendingHeadItems, withTrendingHead } from "./trendingHead";
import type { RecoRowItem } from "./rowItem";

const item = (key: string): RecoRowItem => ({
  key, mediaType: "movie", tmdbId: Number(key.split(":")[1]), title: key, year: null, posterPath: "/p.jpg",
  backdropPath: null, jellyfinItemId: null, source: "trending", score: 1, voteAverage: null, reasons: [], providers: null,
});
const keys = (...n: number[]) => n.map((i) => item(`movie:${i}`));
const row = (key: string, ...n: number[]) => ({ key, items: keys(...n) });

describe("withTrendingHead", () => {
  it("met « Tendances actuelles » en tête, dans l'ordre servi ; la rangée goûtée reste entière (accueil)", () => {
    const rows = [row("forYou", 1, 2, 3, 4, 5, 6, 7, 8), row("trending", 30, 31, 22, 23, 24, 25)];
    const out = withTrendingHead(rows, keys(30, 31, 32, 33, 34, 35));
    expect(out.map((r) => r.key)).toEqual(["trendingNow", "forYou", "trending"]);
    expect(out[2]).toBe(rows[1]);
    expect(out[0].items.map((i) => i.key)).toEqual(["movie:30", "movie:31", "movie:32", "movie:33", "movie:34", "movie:35"]);
  });

  it("un titre ne paraît qu'une fois : les rangées suivantes perdent ceux de la tête", () => {
    const rows = [row("forYou", 1, 2, 3, 4, 5, 6, 7, 30), row("discover", 31, 40, 41, 42)];
    const out = withTrendingHead(rows, keys(30, 31, 32, 33, 34, 35));
    expect(out.map((r) => r.key)).toEqual(["trendingNow", "forYou"]);
    expect(out[1].items.map((i) => i.key)).not.toContain("movie:30");
  });

  it("trop mince, la tête n'est pas servie : la page reste celle d'avant", () => {
    const rows = [row("forYou", 1, 2, 3, 4, 5, 6), row("trending", 20, 21, 22, 23, 24, 25)];
    expect(withTrendingHead(rows, keys(30, 31))).toEqual(rows);
  });
});

describe("trendingHeadItems", () => {
  const ctx = { exclude: new Set<string>(), includeVigie: true, tmdbConfigured: true, trendingNow: true };

  it("préférence coupée ou sans clé TMDB : aucune tête, la page reste EXACTEMENT celle d'avant", async () => {
    const rows = [row("forYou", 1, 2, 3, 4, 5, 6), row("trending", 20, 21, 22, 23, 24, 25)];
    for (const off of [{ ...ctx, trendingNow: false }, { ...ctx, tmdbConfigured: false }]) {
      const head = await trendingHeadItems("u1", off, null);
      expect(head).toEqual([]);
      expect(withTrendingHead(rows, head)).toEqual(rows);
    }
  });
});
