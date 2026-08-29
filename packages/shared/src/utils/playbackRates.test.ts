import { describe, it, expect } from "vitest";
import { PLAYBACK_RATES, NORMAL_RATE, formatRate, isNormalRate } from "./playbackRates";

describe("paliers de vitesse de lecture", () => {
  it("va de 0,5x a 4x, dans l'ordre croissant", () => {
    expect(PLAYBACK_RATES[0]).toBe(0.5);
    expect(PLAYBACK_RATES[PLAYBACK_RATES.length - 1]).toBe(4);
    const ascending = [...PLAYBACK_RATES].every((t, i, a) => i === 0 || a[i - 1] < t);
    expect(ascending).toBe(true);
  });

  it("ne depasse jamais 4x — au-dela Chromium coupe le son", () => {
    expect(PLAYBACK_RATES.every((t) => t <= 4)).toBe(true);
  });

  it("contient la vitesse normale", () => {
    expect(PLAYBACK_RATES).toContain(NORMAL_RATE);
  });

  it("ne propose aucun doublon", () => {
    expect(new Set(PLAYBACK_RATES).size).toBe(PLAYBACK_RATES.length);
  });
});

describe("formatRate", () => {
  it("retire les zeros de queue", () => {
    expect(formatRate(1)).toBe("1x");
    expect(formatRate(2)).toBe("2x");
    expect(formatRate(4)).toBe("4x");
  });

  it("garde les decimales utiles", () => {
    expect(formatRate(0.5)).toBe("0.5x");
    expect(formatRate(0.75)).toBe("0.75x");
    expect(formatRate(1.25)).toBe("1.25x");
    expect(formatRate(1.75)).toBe("1.75x");
    expect(formatRate(3.5)).toBe("3.5x");
  });

  it("produit un libelle pour chaque palier propose", () => {
    expect(PLAYBACK_RATES.map(formatRate)).toEqual([
      "0.5x", "0.75x", "1x", "1.25x", "1.5x", "1.75x", "2x", "2.5x", "3x", "3.5x", "4x",
    ]);
  });
});

describe("isNormalRate", () => {
  it("reconnait 1x", () => {
    expect(isNormalRate(1)).toBe(true);
  });

  it("rejette les autres paliers", () => {
    expect(isNormalRate(0.75)).toBe(false);
    expect(isNormalRate(1.25)).toBe(false);
    expect(isNormalRate(4)).toBe(false);
  });

  it("tolere l'imprecision flottante", () => {
    // 0.5 + 0.25 + 0.25 ne vaut pas exactement 1 en binaire.
    expect(isNormalRate(0.5 + 0.25 + 0.25)).toBe(true);
  });
});
