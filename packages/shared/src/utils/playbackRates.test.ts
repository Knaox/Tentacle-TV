import { describe, it, expect } from "vitest";
import { TAUX_LECTURE, TAUX_NORMAL, formaterTaux, estTauxNormal } from "./playbackRates";

describe("paliers de vitesse de lecture", () => {
  it("va de 0,5x a 4x, dans l'ordre croissant", () => {
    expect(TAUX_LECTURE[0]).toBe(0.5);
    expect(TAUX_LECTURE[TAUX_LECTURE.length - 1]).toBe(4);
    const croissant = [...TAUX_LECTURE].every((t, i, a) => i === 0 || a[i - 1] < t);
    expect(croissant).toBe(true);
  });

  it("ne depasse jamais 4x — au-dela Chromium coupe le son", () => {
    expect(TAUX_LECTURE.every((t) => t <= 4)).toBe(true);
  });

  it("contient la vitesse normale", () => {
    expect(TAUX_LECTURE).toContain(TAUX_NORMAL);
  });

  it("ne propose aucun doublon", () => {
    expect(new Set(TAUX_LECTURE).size).toBe(TAUX_LECTURE.length);
  });
});

describe("formaterTaux", () => {
  it("retire les zeros de queue", () => {
    expect(formaterTaux(1)).toBe("1x");
    expect(formaterTaux(2)).toBe("2x");
    expect(formaterTaux(4)).toBe("4x");
  });

  it("garde les decimales utiles", () => {
    expect(formaterTaux(0.5)).toBe("0.5x");
    expect(formaterTaux(0.75)).toBe("0.75x");
    expect(formaterTaux(1.25)).toBe("1.25x");
    expect(formaterTaux(1.75)).toBe("1.75x");
    expect(formaterTaux(3.5)).toBe("3.5x");
  });

  it("produit un libelle pour chaque palier propose", () => {
    expect(TAUX_LECTURE.map(formaterTaux)).toEqual([
      "0.5x", "0.75x", "1x", "1.25x", "1.5x", "1.75x", "2x", "2.5x", "3x", "3.5x", "4x",
    ]);
  });
});

describe("estTauxNormal", () => {
  it("reconnait 1x", () => {
    expect(estTauxNormal(1)).toBe(true);
  });

  it("rejette les autres paliers", () => {
    expect(estTauxNormal(0.75)).toBe(false);
    expect(estTauxNormal(1.25)).toBe(false);
    expect(estTauxNormal(4)).toBe(false);
  });

  it("tolere l'imprecision flottante", () => {
    // 0.5 + 0.25 + 0.25 ne vaut pas exactement 1 en binaire.
    expect(estTauxNormal(0.5 + 0.25 + 0.25)).toBe(true);
  });
});
