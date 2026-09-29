import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryEntry, LibraryIndex } from "../../reco/candidates/libraryIndex";

/**
 * Le catalogue commun de bout en bout, Jellyfin et base simulés : deux
 * comptes, l'intersection de leurs bibliothèques, les animés reconnus à la
 * bibliothèque « Animés » (seul signe d'une bibliothèque décrite par TMDB) et
 * au pool, puis la pile classée d'un type.
 */

function entry(key: string, extra: Partial<LibraryEntry> = {}): LibraryEntry {
  const [mediaType, id] = key.split(":");
  return {
    itemId: `it-${key}`, name: `Titre ${key}`, key, mediaType: mediaType as "movie" | "tv", tmdbId: Number(id),
    played: false, isFavorite: false, inWatchlist: false, inProgress: false, playedEpisodes: 0,
    hasPrimaryImage: true, hasBackdrop: false, communityRating: 7, ...extra,
  };
}

function index(entries: LibraryEntry[]): LibraryIndex {
  return { entries, byKey: new Map(entries.map((e) => [e.key, e])) };
}

const libraries: Record<string, LibraryIndex> = {
  a: index([entry("movie:1"), entry("movie:2"), entry("tv:10"), entry("tv:11"), entry("tv:12"), entry("movie:3")]),
  b: index([entry("movie:1"), entry("movie:2"), entry("tv:10"), entry("tv:11"), entry("tv:12")]),
};

vi.mock("../../reco/candidates/libraryMemo", () => ({
  getLibraryIndexMemo: async (userId: string) => libraries[userId],
}));
vi.mock("../../reco/poolStore", () => ({
  readPool: async (userId: string) => userId === "b"
    ? { entries: [{ candidate: { key: "tv:11", facets: [{ key: "universe:anime", mult: 1 }] }, breakdown: { total: 1 } }] }
    : null,
}));
vi.mock("../../swipe/swipeStore", () => ({
  listSwipes: async () => [],
}));
vi.mock("../../configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
  getJellyfinApiKey: () => "cle-admin",
}));

import { catalogDeck, catalogKindCounts, loadGroupCatalog, readableKeys, resetAffinityCatalogForTests } from "./affinityCatalog";
import { resetAnimeLibrariesForTests } from "./affinityAnimeLibraries";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/UserViews?userId=a")) {
      return Response.json({ Items: [{ Id: "lib-films", Name: "Films" }, { Id: "lib-animes", Name: "Animés" }] });
    }
    if (url.includes("ParentId=lib-animes")) {
      return Response.json({ Items: [{ Id: "it-tv:10" }], TotalRecordCount: 1 });
    }
    return new Response("{}", { status: 404 });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetAffinityCatalogForTests();
  resetAnimeLibrariesForTests();
});

describe("affinité — le catalogue commun", () => {
  it("compte par type ce que tout le groupe peut lire", async () => {
    const catalog = await loadGroupCatalog(["a", "b"], "a");
    // movie:3 n'est que chez « a » : hors catalogue.
    expect(catalog.entries.map((e) => e.key)).not.toContain("movie:3");
    // tv:10 par sa bibliothèque « Animés », tv:11 par le pool de « b ».
    expect([...catalog.animeKeys].sort()).toEqual(["tv:10", "tv:11"]);
    expect(catalogKindCounts(catalog)).toEqual({ movie: 2, series: 1, anime: 2 });
  });

  it("sert une pile du seul type choisi, avec l'id Jellyfin de chaque titre", async () => {
    const catalog = await loadGroupCatalog(["a", "b"], "a");
    const deck = catalogDeck(catalog, "anime", "seed");
    expect(deck.map((c) => c.key).sort()).toEqual(["tv:10", "tv:11"]);
    expect(deck.every((c) => c.jellyfinItemId === `it-${c.key}`)).toBe(true);
  });

  it("une bibliothèque injoignable ne prive que du signe de la bibliothèque", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("réseau"); }));
    const catalog = await loadGroupCatalog(["a", "b"], "a");
    expect([...catalog.animeKeys]).toEqual(["tv:11"]);
  });

  it("les titres lisibles d'un compte arrivé après le lancement", async () => {
    expect([...(await readableKeys("b"))]).toHaveLength(5);
  });
});
