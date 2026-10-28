import { describe, expect, it } from "vitest";
import { CROSSFADE_STOPS_S, crossfadeAtPosition, crossfadePosition, crossfadeShape, crossfadeStep } from "./crossfadeControl";

describe("la réglette de la transition douce", () => {
  it("coupée à gauche, puis chaque seconde de 2 à 12", () => {
    expect(CROSSFADE_STOPS_S).toEqual([0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(crossfadeAtPosition(0)).toBe(0);
    expect(crossfadeAtPosition(0.04)).toBe(0);
    expect(crossfadeAtPosition(0.1)).toBe(2_000);
    expect(crossfadeAtPosition(1)).toBe(12_000);
    expect(crossfadeAtPosition(Number.NaN)).toBe(0);
  });

  it("une durée retrouve sa place, et un cran de plus ou de moins", () => {
    expect(crossfadePosition(0)).toBe(0);
    expect(crossfadePosition(12_000)).toBe(1);
    expect(crossfadeAtPosition(crossfadePosition(3_000))).toBe(3_000);
    expect(crossfadeStep(0, 1)).toBe(2_000);
    expect(crossfadeStep(2_000, -1)).toBe(0);
    expect(crossfadeStep(12_000, 1)).toBe(12_000);
  });

  it("le dessin : pas de chevauchement coupée, de plus en plus large avec la durée", () => {
    expect(crossfadeShape(0, 200, 40).overlap).toBe(0);
    const short = crossfadeShape(3_000, 200, 40);
    const long = crossfadeShape(12_000, 200, 40);
    expect(short.overlap).toBeGreaterThan(0);
    expect(long.overlap).toBeGreaterThan(short.overlap);
    expect(long.outgoing.startsWith("M0 40")).toBe(true);
    expect(long.incoming.endsWith("Z")).toBe(true);
  });
});
