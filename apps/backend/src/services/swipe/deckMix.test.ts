import { describe, expect, it } from "vitest";
import { DECK_PATTERN, mixDeck, shuffled } from "./deckMix";
import { blockedKeys, countVerdicts, SKIP_COOLDOWN_DAYS } from "./swipeStore";
import type { DeckSource, SwipeCard } from "./swipeTypes";

function card(key: string, source: DeckSource, inLibrary = false): SwipeCard {
  const [mediaType, id] = key.split(":");
  return {
    key,
    mediaType: mediaType as "movie" | "tv",
    tmdbId: Number(id),
    title: key,
    year: 2020,
    genres: [],
    voteAverage: 7,
    posterPath: "/p.jpg",
    backdropPath: null,
    jellyfinItemId: inLibrary ? `jf${id}` : null,
    source,
    reason: null,
  };
}

const range = (from: number, n: number, source: DeckSource, lib: (i: number) => boolean) =>
  Array.from({ length: n }, (_, i) => card(`movie:${from + i}`, source, lib(i)));

const POOLS = {
  taste: range(100, 40, "taste", (i) => i % 3 === 0),
  popular: range(200, 40, "popular", (i) => i % 4 === 0),
  explore: range(300, 40, "explore", (i) => i % 2 === 0),
};

describe("composition de la pile", () => {
  it("suit le motif : moitié goût, trois dixièmes populaires, deux dixièmes exploration", () => {
    const deck = mixDeck(POOLS, { size: 20, exclude: new Set(), balanceLibrary: false });
    const n = (s: DeckSource) => deck.filter((c) => c.source === s).length;
    expect(deck).toHaveLength(20);
    expect(n("taste")).toBe(10);
    expect(n("popular")).toBe(6);
    expect(n("explore")).toBe(4);
    expect(DECK_PATTERN).toHaveLength(10);
  });

  it("ne sert JAMAIS une clé exclue (jugée, connue, déjà tenue par le client), ni deux fois la même", () => {
    const exclude = new Set(["movie:100", "movie:101", "movie:200", "movie:300"]);
    const dup = { ...POOLS, popular: [card("movie:102", "popular"), ...POOLS.popular] };
    const deck = mixDeck(dup, { size: 60, exclude, balanceLibrary: true });
    const keys = deck.map((c) => c.key);
    for (const k of exclude) expect(keys).not.toContain(k);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("mélange bibliothèque et hors bibliothèque quand TMDB est là", () => {
    const deck = mixDeck(POOLS, { size: 20, exclude: new Set(), balanceLibrary: true });
    const lib = deck.filter((c) => c.jellyfinItemId).length;
    expect(lib).toBeGreaterThanOrEqual(8);
    expect(lib).toBeLessThanOrEqual(12);
  });

  it("une source tarie cède sa place ; la pile ne rétrécit que quand tout est épuisé", () => {
    const deck = mixDeck({ taste: [], popular: POOLS.popular.slice(0, 3), explore: POOLS.explore.slice(0, 2) }, {
      size: 20,
      exclude: new Set(),
      balanceLibrary: true,
    });
    expect(deck).toHaveLength(5);
  });

  it("le mélange garde tous les éléments", () => {
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const items = [1, 2, 3, 4, 5, 6];
    expect(shuffled(items, rnd).sort()).toEqual(items);
  });
});

describe("mémoire des verdicts", () => {
  const now = Date.parse("2026-09-28T00:00:00Z");
  const at = (days: number) => new Date(now - days * 86_400_000);

  it("un verdict bloque pour toujours ; « passé » seulement le temps du délai", () => {
    const blocked = blockedKeys(
      [
        { mediaType: "movie", tmdbId: 1, verdict: "like", updatedAt: at(900) },
        { mediaType: "tv", tmdbId: 2, verdict: "dislike", updatedAt: at(400) },
        { mediaType: "movie", tmdbId: 3, verdict: "skip", updatedAt: at(2) },
        { mediaType: "movie", tmdbId: 4, verdict: "skip", updatedAt: at(SKIP_COOLDOWN_DAYS + 1) },
      ],
      now
    );
    expect([...blocked].sort()).toEqual(["movie:1", "movie:3", "tv:2"]);
  });

  it("compte les verdicts par type", () => {
    const rows = ["like", "like", "superlike", "dislike", "skip"].map((verdict, i) => ({
      mediaType: "movie",
      tmdbId: i,
      verdict,
      updatedAt: at(1),
    }));
    expect(countVerdicts(rows)).toEqual({ like: 2, superlike: 1, dislike: 1, skip: 1 });
  });
});
