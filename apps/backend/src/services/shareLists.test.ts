import { afterEach, describe, expect, it, vi } from "vitest";

/** La liste des titres likés partagée : un like hors bibliothèque que son propriétaire ne verrait pas n'y paraît pas. */

const filterCalls: Array<{ userId: string; tmdbIds: number[] }> = [];

vi.mock("./configStore", () => ({ getJellyfinUrl: () => "http://jf.test", getJellyfinApiKey: () => "cle" }));
vi.mock("./jellyfinAuth", () => ({ jellyfinAuthHeaders: () => ({}) }));
vi.mock("./jellyfin", () => ({ getUserWatchlist: async () => ({ Items: [] }) }));
vi.mock("./db", () => ({
  getPrisma: () => ({
    userLike: {
      findMany: async () => [
        { jellyfinUserId: "owner", mediaType: "movie", tmdbId: 1, createdAt: new Date() },
        { jellyfinUserId: "owner", mediaType: "series", tmdbId: 2, createdAt: new Date() },
      ],
    },
  }),
}));
vi.mock("./tmdb/metaCache", () => ({
  getCachedMeta: async (_type: string, tmdbId: number) => ({ title: tmdbId === 1 ? "Permis" : "Interdit", year: 2020, posterPath: "/p.jpg" }),
}));
vi.mock("./contentPolicy", () => ({
  filterExternalTitles: async (userId: string, titles: { tmdbId: number }[]) => {
    filterCalls.push({ userId, tmdbIds: titles.map((title) => title.tmdbId) });
    return titles.filter((title) => title.tmdbId === 1);
  },
}));

import { getLikedListItems } from "./shareLists";

afterEach(() => {
  vi.unstubAllGlobals();
  filterCalls.length = 0;
});

describe("getLikedListItems", () => {
  it("passe les likes hors bibliothèque au filtre du PROPRIÉTAIRE, et garde ses favoris de Jellyfin", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ Items: [{ Id: "fav", Name: "Favori", Type: "Movie" }] })));
    const items = await getLikedListItems("owner");
    expect(filterCalls).toEqual([{ userId: "owner", tmdbIds: [1, 2] }]);
    expect(items.map((item) => item.Name)).toEqual(["Favori", "Permis"]);
    expect(items[1]).toMatchObject({ Id: "", Type: "Movie", InLibrary: false });
  });
});
