import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryEntry, LibraryIndex } from "../reco/candidates/libraryIndex";
import type { PoolEntry } from "../reco/generationJob";
import { buildDeck } from "./deckService";
import { resetSwipeListsForTests } from "./tmdbLists";

// Tout ce qui touche la base, Jellyfin ou TMDB est remplacé (vi.mock est
// remonté au-dessus des imports) : on éprouve la composition de la pile, pas
// l'infrastructure.
const state = vi.hoisted(() => ({
  tmdb: true,
  pool: null as { entries: PoolEntry[] } | null,
  swipes: [] as Array<{ mediaType: string; tmdbId: number; verdict: string; updatedAt: Date }>,
  library: null as unknown as LibraryIndex,
  known: [] as string[],
  trending: [] as Array<{ id: number; title: string }>,
}));

vi.mock("../tmdb/client", () => ({
  tmdbConfigured: () => state.tmdb,
  tmdbFetch: async (path: string) => ({
    results: path.includes("trending/movie")
      ? state.trending.map((t) => ({ ...t, poster_path: "/t.jpg", vote_count: 900, release_date: "2020-01-01", genre_ids: [878] }))
      : [],
  }),
}));
vi.mock("../reco/generationJob", () => ({
  readPool: async () => state.pool,
  bootstrapPool: vi.fn(async () => ({ poolSize: 0 })),
}));
vi.mock("../reco/candidates/libraryMemo", () => ({ getLibraryIndexMemo: async () => state.library }));
vi.mock("../reco/candidates/exclusions", () => ({
  buildExclusions: async () => ({ everywhere: new Set(state.known) }),
}));
vi.mock("./swipeStore", async (orig) => ({
  ...(await orig<typeof import("./swipeStore")>()),
  listSwipes: async () => state.swipes,
}));

function entry(tmdbId: number, over: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    itemId: `jf${tmdbId}`,
    name: `Bibliothèque ${tmdbId}`,
    key: `movie:${tmdbId}`,
    mediaType: "movie",
    tmdbId,
    played: false,
    isFavorite: false,
    inWatchlist: false,
    inProgress: false,
    playedEpisodes: 0,
    hasPrimaryImage: true,
    hasBackdrop: true,
    communityRating: 7,
    Genres: ["Drame"],
    ...over,
  };
}

function poolEntry(tmdbId: number, total: number): PoolEntry {
  return {
    candidate: {
      key: `movie:${tmdbId}`,
      mediaType: "movie",
      tmdbId,
      title: `Pool ${tmdbId}`,
      year: 2019,
      facets: [{ key: "genre:18", mult: 1 }],
      voteAverage: 7.5,
      voteCount: 3000,
      popularity: 10,
      source: "tmdb_rec",
      posterPath: "/p.jpg",
    },
    breakdown: { total, similarity: 0, quality: 0, freshness: 0, popularityPenalty: 0, topContributors: [] },
  };
}

beforeEach(() => {
  resetSwipeListsForTests();
  const entries = [entry(1), entry(2), entry(3, { played: true }), entry(4)];
  state.library = { entries, byKey: new Map(entries.map((e) => [e.key, e])) };
  state.tmdb = true;
  state.pool = { entries: [poolEntry(10, 0.9), poolEntry(11, 0.8), poolEntry(12, 0.7)] };
  state.trending = [{ id: 20, title: "Tendance 20" }, { id: 21, title: "Tendance 21" }];
  state.swipes = [];
  state.known = [];
});

describe("pile du compte", () => {
  it("mêle pool, tendances TMDB et bibliothèque, avec leurs genres traduits", async () => {
    const { cards, tmdbConfigured } = await buildDeck("u1", { lang: "fr", size: 20, exclude: [] });
    const keys = cards.map((c) => c.key);
    expect(tmdbConfigured).toBe(true);
    expect(keys).toEqual(expect.arrayContaining(["movie:10", "movie:20", "movie:1"]));
    expect(keys).not.toContain("movie:3"); // déjà vu
    expect(cards.find((c) => c.key === "movie:20")!.genres).toEqual(["Science-fiction"]);
    expect(cards.some((c) => c.jellyfinItemId) && cards.some((c) => !c.jellyfinItemId)).toBe(true);
  });

  it("ne repropose JAMAIS un titre jugé, quelle que soit sa source ; un « passé » récent non plus", async () => {
    const now = new Date();
    state.swipes = [
      { mediaType: "movie", tmdbId: 10, verdict: "like", updatedAt: now },
      { mediaType: "movie", tmdbId: 20, verdict: "dislike", updatedAt: now },
      { mediaType: "movie", tmdbId: 1, verdict: "superlike", updatedAt: now },
      { mediaType: "movie", tmdbId: 11, verdict: "skip", updatedAt: now },
    ];
    const { cards, counts } = await buildDeck("u1", { lang: "fr", size: 40, exclude: ["movie:2"] });
    const keys = cards.map((c) => c.key);
    for (const k of ["movie:10", "movie:20", "movie:1", "movie:11", "movie:2"]) expect(keys).not.toContain(k);
    expect(counts).toEqual({ like: 1, superlike: 1, dislike: 1, skip: 1 });
  });

  it("sans clé TMDB : la bibliothèque seule, et le client le sait", async () => {
    state.tmdb = false;
    state.pool = null;
    const { cards, tmdbConfigured } = await buildDeck("u1", { lang: "en", size: 20, exclude: [] });
    expect(tmdbConfigured).toBe(false);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => c.jellyfinItemId)).toBe(true);
  });
});
