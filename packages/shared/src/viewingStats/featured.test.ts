import { describe, expect, it } from "vitest";
import type { ViewingStats, ViewingStatsTitle } from "../types/viewingStats";
import { statsFeaturedItems } from "./featured";

const title = (id: string, kind: "movie" | "series", seconds: number, backdropTag: string | null): ViewingStatsTitle => ({
  id, name: id, kind, seconds, episodes: 0, viewings: 0, year: null, anime: false, primaryTag: null, backdropTag, lastPlayedAt: null,
});

describe("statsFeaturedItems", () => {
  it("prend le titre le plus regardé qui a une image large", () => {
    const stats = {
      topSeries: [title("s1", "series", 9000, null), title("s2", "series", 4000, "b2")],
      movies: [title("m1", "movie", 7000, "b1")],
    } as unknown as ViewingStats;
    expect(statsFeaturedItems(stats)).toEqual([{ Id: "m1", Name: "m1", Type: "Movie", BackdropImageTags: ["b1"] }]);
  });

  it("ne rend rien sans données ni image", () => {
    expect(statsFeaturedItems(undefined)).toBeUndefined();
    expect(statsFeaturedItems({ topSeries: [title("s", "series", 1, null)], movies: [] } as unknown as ViewingStats)).toBeUndefined();
  });
});
