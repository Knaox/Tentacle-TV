import { describe, expect, it } from "vitest";
import { lensBezel, lensGeometryFrom, readSpecularLight, sameLens } from "./lensTokens";

/**
 * De la surface mesurée et des jetons à la géométrie de sa lentille : le
 * biseau suit le rayon, la force est une fraction du biseau, la lumière vient
 * des jetons du thème.
 */

const TOKENS: Record<string, string> = {
  "--lg-bezel-ratio": " 0.6",
  "--lg-bezel-min": "8px",
  "--lg-bezel-max": "22px",
  "--lg-refraction-regular": "0.6",
  "--lg-refraction-clear": "0.8",
  "--lg-dispersion": "0.1",
  "--lg-light-angle": "-18",
  "--lg-specular-facing": "0.85",
  "--lg-specular-opposite": "0.42",
  "--lg-specular-base": "0.1",
  "--lg-specular-rim": "1.5",
  "--lg-specular-glow": "0.16",
};
const read = (name: string) => TOKENS[name] ?? "";

describe("lensBezel", () => {
  it("ratio × rayon, borné", () => {
    expect(lensBezel(22, 0.6, 8, 22)).toBe(13);
    expect(lensBezel(4, 0.6, 8, 22)).toBe(8);
    expect(lensBezel(200, 0.6, 8, 22)).toBe(22);
  });
});

describe("lensGeometryFrom", () => {
  it("une capsule de 44 px : biseau sur le demi-rayon, force en fraction du biseau", () => {
    const lens = lensGeometryFrom({ width: 300, height: 44, cssRadius: 9999, shape: "capsule", level: "regular" }, read);
    expect(lens).toMatchObject({ width: 300, height: 44, radius: 22, bezel: 13, strength: 7.8, dispersion: 0 });
  });

  it("un panneau arrondi : le rayon des feuilles, le biseau plafonné", () => {
    const lens = lensGeometryFrom({ width: 400, height: 300, cssRadius: 28, shape: "rounded", level: "regular" }, read);
    expect(lens).toMatchObject({ radius: 28, bezel: 17 });
  });

  it("le biseau ne mange jamais le centre d'une petite surface", () => {
    const lens = lensGeometryFrom({ width: 24, height: 12, cssRadius: 6, shape: "rounded", level: "regular" }, read);
    expect(lens?.bezel).toBeLessThanOrEqual(5);
  });

  it("le verre clair : plus de force, et sa frange chromatique", () => {
    const lens = lensGeometryFrom({ width: 96, height: 96, cssRadius: 48, shape: "circle", level: "clear" }, read);
    expect(lens).toMatchObject({ bezel: 22, strength: 17.6, dispersion: 0.1 });
  });

  it("sans taille : rien", () => {
    expect(lensGeometryFrom({ width: 0, height: 40, cssRadius: 0, shape: "rect", level: "regular" }, read)).toBeNull();
  });
});

describe("readSpecularLight et sameLens", () => {
  it("la lumière vient des jetons ; des défauts sûrs s'ils manquent", () => {
    expect(readSpecularLight(read)).toEqual({ angle: -18, facing: 0.85, opposite: 0.42, base: 0.1, rim: 1.5, glow: 0.16 });
    expect(readSpecularLight(() => "").facing).toBeGreaterThan(0);
  });

  it("une autre lumière (thème) refait la carte", () => {
    const a = lensGeometryFrom({ width: 120, height: 40, cssRadius: 20, shape: "capsule", level: "regular" }, read);
    if (a === null) throw new Error("géométrie attendue");
    expect(sameLens(a, { ...a })).toBe(true);
    expect(sameLens(a, { ...a, light: { ...a.light, facing: 0.95 } })).toBe(false);
    expect(sameLens(null, a)).toBe(false);
  });
});
