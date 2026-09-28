import { describe, expect, it } from "vitest";
import { INITIAL_SWIPE_DECK, deckExcludeKeys, swipeDeckReducer } from "./swipeDeckState";
import type { SwipeDeckAction, SwipeDeckState } from "./swipeDeckState";
import type { SwipeCard } from "./swipeTypes";

const card = (id: number): SwipeCard => ({
  key: `movie:${id}`,
  mediaType: "movie",
  tmdbId: id,
  title: `Film ${id}`,
  year: 2020,
  genres: [],
  voteAverage: 7,
  posterPath: "/p.jpg",
  backdropPath: null,
  jellyfinItemId: null,
  source: "taste",
  reason: null,
});

const run = (...actions: SwipeDeckAction[]): SwipeDeckState => actions.reduce(swipeDeckReducer, INITIAL_SWIPE_DECK);
const SERVER_COUNTS = { like: 5, superlike: 1, dislike: 2, skip: 0 };

describe("séance de swipe", () => {
  it("le premier lot pose la file et les compteurs du serveur", () => {
    const s = run({ type: "loaded", cards: [card(1), card(2)], counts: SERVER_COUNTS });
    expect(s.queue.map((c) => c.key)).toEqual(["movie:1", "movie:2"]);
    expect(s.counts).toEqual(SERVER_COUNTS);
    expect(s.loaded).toBe(true);
  });

  it("juger retire la carte du dessus, la compte et la retient pour l'exclusion", () => {
    const s = run({ type: "loaded", cards: [card(1), card(2)], counts: SERVER_COUNTS }, { type: "judged", verdict: "superlike" });
    expect(s.queue.map((c) => c.key)).toEqual(["movie:2"]);
    expect(s.counts.superlike).toBe(2);
    expect(deckExcludeKeys(s)).toEqual(["movie:2", "movie:1"]);
  });

  it("un lot suivant n'écrase pas les compteurs et ne ramène ni doublon ni carte jugée", () => {
    const s = run(
      { type: "loaded", cards: [card(1), card(2)], counts: SERVER_COUNTS },
      { type: "judged", verdict: "like" },
      { type: "loaded", cards: [card(1), card(2), card(3), card(3)], counts: { like: 99, superlike: 0, dislike: 0, skip: 0 } }
    );
    expect(s.queue.map((c) => c.key)).toEqual(["movie:2", "movie:3"]);
    expect(s.counts.like).toBe(6);
  });

  it("annuler remet la carte en haut et décompte le verdict", () => {
    const s = run(
      { type: "loaded", cards: [card(1), card(2)], counts: SERVER_COUNTS },
      { type: "judged", verdict: "dislike" },
      { type: "judged", verdict: "like" },
      { type: "undone" }
    );
    expect(s.queue.map((c) => c.key)).toEqual(["movie:2"]);
    expect(s.counts).toEqual({ ...SERVER_COUNTS, dislike: 3 });
    const back = swipeDeckReducer(s, { type: "undone" });
    expect(back.queue.map((c) => c.key)).toEqual(["movie:1", "movie:2"]);
    expect(back.counts).toEqual(SERVER_COUNTS);
    expect(back.history).toHaveLength(0);
    expect(swipeDeckReducer(back, { type: "undone" })).toBe(back);
  });

  it("un enregistrement échoué rend la carte et efface son verdict, même après d'autres gestes", () => {
    const s = run(
      { type: "loaded", cards: [card(1), card(2), card(3)] },
      { type: "judged", verdict: "like" },
      { type: "judged", verdict: "skip" },
      { type: "restore", key: "movie:1" }
    );
    expect(s.queue.map((c) => c.key)).toEqual(["movie:1", "movie:3"]);
    expect(s.history.map((h) => h.card.key)).toEqual(["movie:2"]);
    expect(s.counts.like).toBe(0);
  });

  it("un lot vide signale que le serveur est à sec ; une annulation relance", () => {
    const s = run({ type: "loaded", cards: [card(1)] }, { type: "judged", verdict: "like" }, { type: "loaded", cards: [] });
    expect(s.exhausted).toBe(true);
    expect(swipeDeckReducer(s, { type: "undone" }).exhausted).toBe(false);
  });
});
