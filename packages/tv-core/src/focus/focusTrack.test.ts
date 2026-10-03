import { describe, expect, it } from "vitest";
import { EMPTY_FOCUS_TRACK, trackFocus, type FocusTrack } from "./focusTrack";

const run = (events: Array<[string, boolean]>, from: FocusTrack = EMPTY_FOCUS_TRACK) =>
  events.reduce((track, [key, focused]) => trackFocus(track, key, focused), from);

describe("trackFocus — le suivi du focus d'un écran", () => {
  it("la prise pose la clé courante et la dernière", () => {
    expect(run([["hero:primary", true]])).toEqual({ current: "hero:primary", last: "hero:primary" });
  });

  it("la perte vide la clé courante, la dernière reste", () => {
    expect(run([["hero:primary", true], ["hero:primary", false]])).toEqual({ current: null, last: "hero:primary" });
  });

  it("tvOS : le flou de l'ancien puis le focus du nouveau", () => {
    expect(run([["a", true], ["a", false], ["b", true]])).toEqual({ current: "b", last: "b" });
  });

  it("un flou en retard (élément démonté) n'efface pas le focus posé ailleurs", () => {
    expect(run([["a", true], ["b", true], ["a", false]])).toEqual({ current: "b", last: "b" });
  });

  it("une perte sans prise ne change rien", () => {
    const start = run([["a", true]]);
    expect(trackFocus(start, "z", false)).toBe(start);
  });

  it("la même prise répétée rend le même suivi", () => {
    const start = run([["a", true]]);
    expect(trackFocus(start, "a", true)).toBe(start);
  });
});
