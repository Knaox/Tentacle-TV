import { describe, expect, it } from "vitest";
import { activeDestinationIndex } from "./activeDestination";

const DEST = [
  { to: "/octave", end: true },
  { to: "/octave/search", end: false },
  { to: "/octave/library", end: false },
];

describe("activeDestinationIndex", () => {
  it("l'accueil seulement sur lui-même", () => {
    expect(activeDestinationIndex("/octave", DEST)).toBe(0);
    expect(activeDestinationIndex("/octave/", DEST)).toBe(0);
  });
  it("une destination et ses sous-pages", () => {
    expect(activeDestinationIndex("/octave/search", DEST)).toBe(1);
    expect(activeDestinationIndex("/octave/library/albums", DEST)).toBe(2);
  });
  it("hors des onglets : aucun", () => {
    expect(activeDestinationIndex("/octave/album/42", DEST)).toBe(-1);
    expect(activeDestinationIndex("/octave/searching", DEST)).toBe(-1);
  });
});
