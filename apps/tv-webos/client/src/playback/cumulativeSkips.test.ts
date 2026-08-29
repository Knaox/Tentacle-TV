import { describe, expect, it } from "vitest";
import { accumulate, TOTAL_WINDOW_MS, type SkipTotal } from "./cumulativeSkips";

/**
 * Trois appuis sur « +30 » doivent afficher « +90 », pas trois fois « +30 ».
 * C'est tout ce que ce module fait, et c'est invérifiable à l'œil : le badge
 * disparaît avant qu'on ait pu comparer.
 */

/** Enchaîne des sauts et rend ce que le badge affiche à chaque fois. */
function suite(skips: { delta: number; after: number }[]): number[] {
  let memory: SkipTotal | null = null;
  let instant = 0;
  return skips.map(({ delta, after }) => {
    instant += after;
    memory = accumulate(memory, delta, instant);
    return memory.total;
  });
}

describe("cumulativeSkips", () => {
  it("additionne les sauts consécutifs de même sens", () => {
    expect(suite([
      { delta: 30, after: 0 },
      { delta: 30, after: 300 },
      { delta: 30, after: 300 },
    ])).toEqual([30, 60, 90]);
  });

  it("additionne aussi vers l'arrière", () => {
    expect(suite([
      { delta: -10, after: 0 },
      { delta: -10, after: 200 },
      { delta: -10, after: 200 },
    ])).toEqual([-10, -20, -30]);
  });

  it("repart de zéro quand le sens change", () => {
    // « +20 » ne correspondrait à aucun geste.
    expect(suite([
      { delta: 30, after: 0 },
      { delta: 30, after: 200 },
      { delta: -10, after: 200 },
    ])).toEqual([30, 60, -10]);
  });

  it("repart de zéro passée la fenêtre — deux intentions, pas une", () => {
    expect(suite([
      { delta: 30, after: 0 },
      { delta: 30, after: TOTAL_WINDOW_MS + 1 },
    ])).toEqual([30, 30]);
  });

  it("cumule tant qu'on reste DANS la fenêtre, même longtemps", () => {
    const skips = Array.from({ length: 6 }, (_, i) => ({
      delta: 30,
      after: i === 0 ? 0 : TOTAL_WINDOW_MS - 100,
    }));
    expect(suite(skips)).toEqual([30, 60, 90, 120, 150, 180]);
  });
});
