import { describe, expect, it } from "vitest";
import type { SwipeCard } from "../swipe/swipeTypes";
import {
  AFFINITY_HISTORY_MAX, INITIAL_AFFINITY_DECK, affinityDeckReducer, affinityExcludeKeys, type AffinityDeckAction,
} from "./affinityDeckState";

/** La pile d'affinité côté client : file sans doublon, deux verdicts,
 *  annulation, geste non enregistré rendu. */

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

  it("n'écarte des recharges que sa file : un titre jugé, le serveur le sait", () => {
    const s = run(
      { type: "loaded", cards: [card(1), card(2), card(3)] },
      { type: "judged", verdict: "dislike" },
      { type: "judged", verdict: "like" },
    );
    expect(affinityExcludeKeys(s)).toEqual(["movie:3"]);
    expect(s.history.map((h) => [h.card.key, h.verdict])).toEqual([["movie:1", "dislike"], ["movie:2", "like"]]);
  });

  it("annuler rend la carte en haut, et relance les recharges", () => {
    const s = run(
      { type: "loaded", cards: [card(1)] },
      { type: "judged", verdict: "like" },
      { type: "loaded", cards: [] },
    );
    expect(s.exhausted).toBe(true);
    const back = affinityDeckReducer(s, { type: "undone" });
    expect(back.queue.map((c) => c.key)).toEqual(["movie:1"]);
    expect(back.history).toEqual([]);
    expect(back.exhausted).toBe(false);
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

  it("borne l'historique d'annulation, et repart de zéro à une nouvelle séance", () => {
    const cards = Array.from({ length: AFFINITY_HISTORY_MAX + 5 }, (_, i) => card(i + 1));
    const likes = cards.map((): AffinityDeckAction => ({ type: "judged", verdict: "like" }));
    const s = run({ type: "loaded", cards }, ...likes);
    expect(s.history).toHaveLength(AFFINITY_HISTORY_MAX);
    expect(affinityDeckReducer(s, { type: "reset" })).toBe(INITIAL_AFFINITY_DECK);
  });
});
