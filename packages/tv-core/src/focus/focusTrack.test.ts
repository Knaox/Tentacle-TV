import { describe, expect, it } from "vitest";
import { EMPTY_FOCUS_TRACK, trackFocus, type FocusTrack } from "./focusTrack";

const run = (events: Array<[string, boolean]>, from: FocusTrack = EMPTY_FOCUS_TRACK) =>
  events.reduce((track, [key, focused]) => trackFocus(track, key, focused), from);

describe("trackFocus — le suivi du focus d'un écran", () => {
  it("la prise pose la clé courante et la dernière", () => {
    expect(run([["hero:primary", true]])).toEqual({ current: "hero:primary", last: "hero:primary", held: ["hero:primary"] });
  });

  it("la perte vide la clé courante, la dernière reste", () => {
    expect(run([["hero:primary", true], ["hero:primary", false]])).toEqual({ current: null, last: "hero:primary", held: [] });
  });

  it("tvOS : le flou de l'ancien puis le focus du nouveau", () => {
    expect(run([["a", true], ["a", false], ["b", true]])).toEqual({ current: "b", last: "b", held: ["b"] });
  });

  it("un flou en retard (élément démonté) n'efface pas le focus posé ailleurs", () => {
    expect(run([["a", true], ["b", true], ["a", false]])).toEqual({ current: "b", last: "b", held: ["b"] });
  });

  it("une perte sans prise ne change rien", () => {
    const start = run([["a", true]]);
    expect(trackFocus(start, "z", false)).toBe(start);
  });

  it("la même prise répétée rend le même suivi", () => {
    const start = run([["a", true]]);
    expect(trackFocus(start, "a", true)).toBe(start);
  });

  it("Android : la prise du héros AVANT un focus de passage sur le rail — le héros porte encore le focus", () => {
    expect(run([["home:loading", true], ["hero:primary", true], ["home:loading", false], ["nav:Search", true], ["nav:Search", false]])).toEqual({
      current: "hero:primary",
      last: "hero:primary",
      held: ["hero:primary"],
    });
  });

  it("tvOS : jamais plus d'une clé tenue — le suivi est celui d'avant", () => {
    const track = run([["a", true], ["a", false], ["b", true], ["b", false], ["c", true]]);
    expect(track).toEqual({ current: "c", last: "c", held: ["c"] });
  });

  it("une perte jamais annoncée ne s'accumule pas au-delà de quatre clés", () => {
    const track = run([["a", true], ["b", true], ["c", true], ["d", true], ["e", true]]);
    expect(track.held).toEqual(["b", "c", "d", "e"]);
  });
});
