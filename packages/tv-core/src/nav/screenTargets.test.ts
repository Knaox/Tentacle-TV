import { describe, expect, it } from "vitest";
import { detailPlayPress, sagaEntryPress } from "./screenTargets";

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

describe("les volets de la saga", () => {
  it("« Cette fiche » : rien ; un volet de la bibliothèque : sa fiche", () => {
    expect(sagaEntryPress({ current: true, absent: false, canRequest: true })).toBe("none");
    expect(sagaEntryPress({ current: false, absent: false, canRequest: false })).toBe("open");
  });

  it("un volet absent se demande quand la garde est ouverte, sinon l'avis", () => {
    expect(sagaEntryPress({ current: false, absent: true, canRequest: true })).toBe("request");
    expect(sagaEntryPress({ current: false, absent: true, canRequest: false })).toBe("notInLibrary");
  });
});
