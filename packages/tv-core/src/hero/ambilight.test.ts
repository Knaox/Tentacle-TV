import { describe, expect, it } from "vitest";
import {
  phi,
  probit,
  haloProfile,
  haloRamp,
  blurRadius,
  effectiveSigma,
  haloSigma,
  sigmaSource,
  subScale,
  androidBlurSetting,
  androidScreenSigma,
} from "./ambilight";

/** Les nombres de la référence web : blur(48px) sur une carte de 1524 px. */
const RATIO = 48 / 1524;
const SPEC = { blurRatio: RATIO, layers: 16, alphaFloor: 0.01 };
const CARD_TVOS = 1526; // 1920 − 2×(90 + 96) − 2×56

describe("profil", () => {
  it("vaut une demie sur l'arête — un flou floute aussi l'alpha", () => {
    expect(haloProfile(0, 48)).toBeCloseTo(0.5, 6);
  });

  it("probit inverse phi", () => {
    for (const p of [0.02, 0.16, 0.5, 0.84, 0.98]) {
      expect(phi(probit(p))).toBeCloseTo(p, 5);
    }
  });

  it("σ suit la largeur de la carte, pas l'écran", () => {
    expect(haloSigma(1524, RATIO)).toBeCloseTo(48, 6);
    // Android TV compose en 960 dp : la carte fait la moitié, σ aussi.
    expect(haloSigma(763, RATIO)).toBeCloseTo(24.03, 2);
  });
});

describe("rampe", () => {
  const ramp = haloRamp(CARD_TVOS, SPEC);
  const step = (0.5 - SPEC.alphaFloor) / SPEC.layers;

  it("reconstruit exactement le composite visé", () => {
    for (let k = 1; k <= SPEC.layers; k += 1) {
      let remaining = 1;
      for (let i = k; i <= SPEC.layers; i += 1) remaining *= 1 - ramp.layers[i - 1].opacity;
      expect(1 - remaining).toBeCloseTo(0.5 - (k - 0.5) * step, 10);
    }
  });

  it("ne laisse aucune marche au-dessus du pas", () => {
    let previous = 0.5;
    let remaining = 1;
    for (let k = 1; k <= SPEC.layers; k += 1) {
      let r = 1;
      for (let i = k; i <= SPEC.layers; i += 1) r *= 1 - ramp.layers[i - 1].opacity;
      const composite = 1 - r;
      expect(previous - composite).toBeLessThanOrEqual(step + 1e-9);
      previous = composite;
      remaining = r;
    }
    // La dernière marche — celle qui tombe à zéro — vaut plancher + pas/2.
    // À 0,55 d'opacité d'ensemble, ça fait 1,4 % : trois niveaux sur 255, sur
    // la zone la plus délavée du halo, et la magnification du cache l'étale.
    expect(1 - remaining).toBeCloseTo(SPEC.alphaFloor + step / 2, 6);
    expect((1 - remaining) * 0.55).toBeLessThan(0.016);
  });

  it("colle au profil gaussien au milieu de chaque anneau", () => {
    let previousD = 0;
    for (let k = 1; k <= SPEC.layers; k += 1) {
      const d = ramp.layers[k - 1].d;
      const targeted = 0.5 - (k - 0.5) * step;
      expect(Math.abs(targeted - haloProfile((previousD + d) / 2, ramp.sigma))).toBeLessThan(step);
      previousD = d;
    }
  });

  it("dilate strictement, et aucune couche n'est la grosse", () => {
    let previous = 0;
    for (const { d, opacity } of ramp.layers) {
      expect(d).toBeGreaterThan(previous);
      previous = d;
      expect(opacity).toBeGreaterThan(0.02);
      expect(opacity).toBeLessThan(0.06);
    }
    expect(ramp.bleed).toBe(ramp.layers[SPEC.layers - 1].d);
    // Débordement ≈ 2,33 σ (Φ⁻¹(0,99)) — sous les 152 pt disponibles à droite.
    expect(ramp.bleed).toBeGreaterThan(2.2 * ramp.sigma);
    expect(ramp.bleed).toBeLessThan(2.5 * ramp.sigma);
  });

  it("laisse une sous-échelle utilisable sur tvOS", () => {
    expect(subScale(ramp.layers)).toBeGreaterThanOrEqual(2);
    // Sur Android TV (960 dp) les écarts sont deux fois plus serrés : K = 1.
    expect(subScale(haloRamp(763, SPEC).layers)).toBe(1);
  });
});

describe("flou natif", () => {
  it("rejoue la formule d'iOS — trois passes de boîte", () => {
    // R = 48 sur un bitmap de 128 px : le noyau vaut 18 % de la largeur.
    expect(effectiveSigma(48, "ios", 1)).toBeGreaterThan(0.17 * 128);
  });

  it("Android floute MOINS fort qu'iOS à valeur égale", () => {
    // Deux passes de boîte contre trois : 0,41·R contre 0,47·R. L'écart est de
    // 15 %, pas les 70 % qu'on croirait en comparant les seules formules.
    const ios = effectiveSigma(16, "ios", 1);
    const android = effectiveSigma(16, "android", 1);
    expect(android).toBeLessThan(ios);
    expect(android / ios).toBeGreaterThan(0.8);
  });

  it("s'inverse au demi-cran près, quelle que soit la densité", () => {
    // Les σ atteignables sont espacés d'environ un pixel (noyau entier impair),
    // et cet espacement ne dépend PAS de la densité d'écran — seule la finesse
    // du rayon à poser en dépend. L'erreur est donc toujours sous un demi-cran.
    for (const platform of ["ios", "android"] as const) {
      for (const ratio of [1, 1.5, 2, 3]) {
        for (const target of [5, 7.2, 11, 18]) {
          const reached = effectiveSigma(blurRadius(target, platform, ratio), platform, ratio);
          expect(Math.abs(reached - target)).toBeLessThan(0.55);
        }
      }
    }
  });

  it("vise juste au point de fonctionnement (source 256 px)", () => {
    for (const platform of ["ios", "android"] as const) {
      for (const ratio of [1, 2]) {
        const reached = effectiveSigma(blurRadius(7.05, platform, ratio), platform, ratio);
        expect(Math.abs(reached - 7.05) / 7.05).toBeLessThan(0.08);
      }
    }
  });

  it("se quantifie grossièrement sous 5 px — la raison de la source en 256", () => {
    // Le noyau de boîte est entier et impair : les σ atteignables sont espacés
    // d'environ 1, donc l'erreur relative du PIRE cas vaut ~0,5/σ. Une source
    // de 128 px viserait σ ≈ 3,5 (14 % dans le pire cas) ; à 256 px on vise
    // ≈ 7 et le pire cas retombe sous 8 %.
    const worst = (a: number, b: number) => {
      let max = 0;
      for (let c = a; c <= b; c += 0.02) {
        const reached = effectiveSigma(blurRadius(c, "ios", 1), "ios", 1);
        max = Math.max(max, Math.abs(reached - c) / c);
      }
      return max;
    };
    expect(worst(3, 4)).toBeGreaterThan(0.12);
    expect(worst(6.5, 8)).toBeLessThan(0.08);
  });

  it("ramène le σ d'écran dans le bitmap", () => {
    const ramp = haloRamp(CARD_TVOS, SPEC);
    const box = CARD_TVOS + 2 * ramp.bleed;
    const target = sigmaSource(ramp.sigma, box, 256);
    // ~3,1 % de la largeur de l'image — le rapport de la référence.
    expect(target / 256).toBeCloseTo(RATIO / (box / CARD_TVOS), 4);
    expect(blurRadius(target, "ios", 1)).toBeGreaterThan(10);
    expect(blurRadius(target, "ios", 1)).toBeLessThan(20);
  });
});

describe("androidBlurSetting", () => {
  // La référence : 48 px de σ pour une carte de 1526, sur les trois plateformes.
  const RATIO = 48 / 1524;
  const CARD = 1526;
  const SOURCE = 256;
  const target = haloSigma(CARD, RATIO);

  it("rend à l'écran le σ visé, à densité 1", () => {
    const { k, stdDeviation } = androidBlurSetting(target, CARD, SOURCE, 1);
    expect(androidScreenSigma(stdDeviation, k)).toBeCloseTo(target * 1, 6);
  });

  it("rend à l'écran le σ visé, à densité 2", () => {
    const { k, stdDeviation } = androidBlurSetting(target, CARD, SOURCE, 2);
    expect(androidScreenSigma(stdDeviation, k)).toBeCloseTo(target * 2, 6);
  });

  // Le plafond de 25 saturait le flou sans rien dire ; on rend plus petit.
  it("réduit le canevas plutôt que de laisser le rayon saturer", () => {
    const { k, stdDeviation } = androidBlurSetting(target, CARD, SOURCE, 2);
    expect(2 * stdDeviation).toBeLessThanOrEqual(25);
    expect(k).toBeGreaterThan(Math.round(CARD / SOURCE));
  });

  it("garde la sous-échelle naturelle quand le plafond ne mord pas", () => {
    const { k } = androidBlurSetting(target, CARD, SOURCE, 1);
    expect(k).toBe(Math.round(CARD / SOURCE));
  });

  // Ce que le code actuel produit, et qui motive tout l'exercice.
  it("mesure l'écart de l'ancienne valeur transmise telle quelle", () => {
    const kNatural = Math.round(CARD / SOURCE);
    const before = androidScreenSigma(target / kNatural, kNatural);
    expect(before / (target * 1)).toBeCloseTo(0.875, 3);
    expect(before / (target * 2)).toBeCloseTo(0.437, 3);
  });
});
