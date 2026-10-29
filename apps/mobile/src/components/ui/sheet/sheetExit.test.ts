import { describe, expect, it } from "vitest";
import { SHEET_EXIT_GUARD_MS, SHEET_EXIT_MS } from "./sheetExit";

/** Le temps de repos d'un ressort d'Animated (seuils par défaut : 0,001 pt et 0,001 pt/s). */
function springRestMs(k: number, c: number, m: number, distance: number): number {
  let x = distance;
  let v = 0;
  let t = 0;
  const dt = 1 / 1000;
  while (t < 5) {
    const a = (-k * x - c * v) / m;
    v += a * dt;
    x += v * dt;
    t += dt;
    if (Math.abs(x) < 0.001 && Math.abs(v) < 0.001) break;
  }
  return t * 1000;
}

describe("sortie d'une feuille du bas", () => {
  it("l'ancien ressort de sortie ne se posait qu'après le garde-fou de 600 ms (la modale retenait les gestes)", () => {
    expect(springRestMs(240, 22, 0.9, 600)).toBeGreaterThan(1000);
  });

  it("la nouvelle sortie rend la page en moins de 300 ms, garde-fou compris", () => {
    expect(SHEET_EXIT_MS).toBeLessThanOrEqual(220);
    expect(SHEET_EXIT_GUARD_MS).toBeLessThan(300);
    // Ancien pire cas : 600 ms (garde-fou du ressort) + 220 ms (second fondu), ≈ 820 ms de gestes avalés.
    expect(600 + 220 - SHEET_EXIT_GUARD_MS).toBeGreaterThan(500);
  });
});
