import { describe, expect, it } from "vitest";
import type { SwipeCard } from "../swipe/swipeTypes";
import {
  AFFINITY_SKIPPED_MAX, INITIAL_AFFINITY_DECK, affinityDeckReducer, affinityExcludeKeys, type AffinityDeckAction,
} from "./affinityDeckState";

/** La pile d'affinité côté client : file, annulation, et titres passés tenus
 *  à l'écart jusqu'à ce qu'on demande à les revoir. */

function card(n: number): SwipeCard {
  return {
    key: `movie:${n}`, mediaType: "movie", tmdbId: n, title: `T${n}`, year: null, genres: [], voteAverage: null,
    posterPath: null, backdropPath: null, jellyfinItemId: `it${n}`, source: "taste", reason: null,
  };
}

function run(...actions: AffinityDeckAction[]) {
  return actions.reduce(affinityDeckReducer, INITIAL_AFFINITY_DECK);
}

describe("pile d'affinité (client)", () => {
  it("empile sans doublon, et se dit épuisée quand rien de neuf n'arrive", () => {
    const s = run({ type: "loaded", cards: [card(1), card(2)] }, { type: "loaded", cards: [card(2)] });
    expect(s.queue.map((c) => c.key)).toEqual(["movie:1", "movie:2"]);
    expect(s.exhausted).toBe(true);
    expect(s.loaded).toBe(true);
  });

  it("un titre passé est écarté des recharges, pas un titre jugé (le serveur le sait)", () => {
    const s = run(
      { type: "loaded", cards: [card(1), card(2), card(3)] },
      { type: "judged", verdict: "skip" },
      { type: "judged", verdict: "like" },
    );
    expect(affinityExcludeKeys(s)).toEqual(["movie:3", "movie:1"]);
    // Resservi par le serveur pendant ce tour : ignoré.
    expect(affinityDeckReducer(s, { type: "loaded", cards: [card(1)] }).queue.map((c) => c.key)).toEqual(["movie:3"]);
  });

  it("revoir les titres passés les laisse revenir", () => {
    const s = run(
      { type: "loaded", cards: [card(1)] },
      { type: "judged", verdict: "skip" },
      { type: "loaded", cards: [] },
    );
    expect(s.exhausted).toBe(true);
    const again = run(
      { type: "loaded", cards: [card(1)] },
      { type: "judged", verdict: "skip" },
      { type: "loaded", cards: [] },
      { type: "revisit" },
      { type: "loaded", cards: [card(1)] },
    );
    expect(again.queue.map((c) => c.key)).toEqual(["movie:1"]);
    expect(again.exhausted).toBe(false);
  });

  it("annuler rend la carte, et la sort des titres passés", () => {
    const s = run(
      { type: "loaded", cards: [card(1), card(2)] },
      { type: "judged", verdict: "skip" },
      { type: "undone" },
    );
    expect(s.queue.map((c) => c.key)).toEqual(["movie:1", "movie:2"]);
    expect(s.skipped).toEqual([]);
    expect(s.history).toEqual([]);
  });

  it("un geste non enregistré remet la carte en haut", () => {
    const s = run(
      { type: "loaded", cards: [card(1), card(2), card(3)] },
      { type: "judged", verdict: "like" },
      { type: "judged", verdict: "dislike" },
      { type: "restore", key: "movie:1" },
    );
    expect(s.queue.map((c) => c.key)).toEqual(["movie:1", "movie:3"]);
    expect(s.history.map((h) => h.card.key)).toEqual(["movie:2"]);
  });

  it("borne les titres passés retenus, et repart de zéro à une nouvelle séance", () => {
    const cards = Array.from({ length: AFFINITY_SKIPPED_MAX + 5 }, (_, i) => card(i + 1));
    const skips = cards.map((): AffinityDeckAction => ({ type: "judged", verdict: "skip" }));
    const s = run({ type: "loaded", cards }, ...skips);
    expect(s.skipped).toHaveLength(AFFINITY_SKIPPED_MAX);
    expect(affinityDeckReducer(s, { type: "reset" })).toBe(INITIAL_AFFINITY_DECK);
  });
});
