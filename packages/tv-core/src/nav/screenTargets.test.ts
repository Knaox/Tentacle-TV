import { describe, expect, it } from "vitest";
import { detailPlayPress } from "./screenTargets";

describe("la pilule de lecture", () => {
  it("un film, un épisode : lui-même", () => {
    expect(detailPlayPress({ id: "m1", isSeries: false }, undefined)).toEqual({ kind: "play", itemId: "m1" });
  });

  it("une série : l'épisode de son état de visionnage, jamais la série", () => {
    expect(detailPlayPress({ id: "s1", isSeries: true }, { completed: false, episodeId: "e5" })).toEqual({ kind: "play", itemId: "e5" });
  });

  it("une série terminée : rien", () => {
    expect(detailPlayPress({ id: "s1", isSeries: true }, { completed: true })).toEqual({ kind: "none" });
  });

  it("une série dont l'état se résout encore : le résoudre au geste", () => {
    expect(detailPlayPress({ id: "s1", isSeries: true }, undefined)).toEqual({ kind: "resolve" });
  });
});
