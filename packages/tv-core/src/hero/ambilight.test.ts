import { describe, expect, it } from "vitest";
import {
  phi,
  probit,
  profilHalo,
  rampeHalo,
  rayonFlou,
  sigmaEffectif,
  sigmaHalo,
  sigmaSource,
  sousEchelle,
} from "./ambilight";

/** Les nombres de la référence web : blur(48px) sur une carte de 1524 px. */
const RAPPORT = 48 / 1524;
const SPEC = { rapportFlou: RAPPORT, couches: 16, plancher: 0.01 };
const CARTE_TVOS = 1526; // 1920 − 2×(90 + 96) − 2×56

describe("profil", () => {
  it("vaut une demie sur l'arête — un flou floute aussi l'alpha", () => {
    expect(profilHalo(0, 48)).toBeCloseTo(0.5, 6);
  });

  it("probit inverse phi", () => {
    for (const p of [0.02, 0.16, 0.5, 0.84, 0.98]) {
      expect(phi(probit(p))).toBeCloseTo(p, 5);
    }
  });

  it("σ suit la largeur de la carte, pas l'écran", () => {
    expect(sigmaHalo(1524, RAPPORT)).toBeCloseTo(48, 6);
    // Android TV compose en 960 dp : la carte fait la moitié, σ aussi.
    expect(sigmaHalo(763, RAPPORT)).toBeCloseTo(24.03, 2);
  });
});

describe("rampe", () => {
  const rampe = rampeHalo(CARTE_TVOS, SPEC);
  const pas = (0.5 - SPEC.plancher) / SPEC.couches;

  it("reconstruit exactement le composite visé", () => {
    for (let k = 1; k <= SPEC.couches; k += 1) {
      let reste = 1;
      for (let i = k; i <= SPEC.couches; i += 1) reste *= 1 - rampe.couches[i - 1].opacity;
      expect(1 - reste).toBeCloseTo(0.5 - (k - 0.5) * pas, 10);
    }
  });

  it("ne laisse aucune marche au-dessus du pas", () => {
    let precedent = 0.5;
    let reste = 1;
    for (let k = 1; k <= SPEC.couches; k += 1) {
      let r = 1;
      for (let i = k; i <= SPEC.couches; i += 1) r *= 1 - rampe.couches[i - 1].opacity;
      const composite = 1 - r;
      expect(precedent - composite).toBeLessThanOrEqual(pas + 1e-9);
      precedent = composite;
      reste = r;
    }
    // La dernière marche — celle qui tombe à zéro — vaut plancher + pas/2.
    // À 0,55 d'opacité d'ensemble, ça fait 1,4 % : trois niveaux sur 255, sur
    // la zone la plus délavée du halo, et la magnification du cache l'étale.
    expect(1 - reste).toBeCloseTo(SPEC.plancher + pas / 2, 6);
    expect((1 - reste) * 0.55).toBeLessThan(0.016);
  });

  it("colle au profil gaussien au milieu de chaque anneau", () => {
    let precedentD = 0;
    for (let k = 1; k <= SPEC.couches; k += 1) {
      const d = rampe.couches[k - 1].d;
      const vise = 0.5 - (k - 0.5) * pas;
      expect(Math.abs(vise - profilHalo((precedentD + d) / 2, rampe.sigma))).toBeLessThan(pas);
      precedentD = d;
    }
  });

  it("dilate strictement, et aucune couche n'est la grosse", () => {
    let precedent = 0;
    for (const { d, opacity } of rampe.couches) {
      expect(d).toBeGreaterThan(precedent);
      precedent = d;
      expect(opacity).toBeGreaterThan(0.02);
      expect(opacity).toBeLessThan(0.06);
    }
    expect(rampe.bleed).toBe(rampe.couches[SPEC.couches - 1].d);
    // Débordement ≈ 2,33 σ (Φ⁻¹(0,99)) — sous les 152 pt disponibles à droite.
    expect(rampe.bleed).toBeGreaterThan(2.2 * rampe.sigma);
    expect(rampe.bleed).toBeLessThan(2.5 * rampe.sigma);
  });

  it("laisse une sous-échelle utilisable sur tvOS", () => {
    expect(sousEchelle(rampe.couches)).toBeGreaterThanOrEqual(2);
    // Sur Android TV (960 dp) les écarts sont deux fois plus serrés : K = 1.
    expect(sousEchelle(rampeHalo(763, SPEC).couches)).toBe(1);
  });
});

describe("flou natif", () => {
  it("rejoue la formule d'iOS — trois passes de boîte", () => {
    // R = 48 sur un bitmap de 128 px : le noyau vaut 18 % de la largeur.
    expect(sigmaEffectif(48, "ios", 1)).toBeGreaterThan(0.17 * 128);
  });

  it("Android floute MOINS fort qu'iOS à valeur égale", () => {
    // Deux passes de boîte contre trois : 0,41·R contre 0,47·R. L'écart est de
    // 15 %, pas les 70 % qu'on croirait en comparant les seules formules.
    const ios = sigmaEffectif(16, "ios", 1);
    const android = sigmaEffectif(16, "android", 1);
    expect(android).toBeLessThan(ios);
    expect(android / ios).toBeGreaterThan(0.8);
  });

  it("s'inverse au demi-cran près, quelle que soit la densité", () => {
    // Les σ atteignables sont espacés d'environ un pixel (noyau entier impair),
    // et cet espacement ne dépend PAS de la densité d'écran — seule la finesse
    // du rayon à poser en dépend. L'erreur est donc toujours sous un demi-cran.
    for (const plateforme of ["ios", "android"] as const) {
      for (const ratio of [1, 1.5, 2, 3]) {
        for (const cible of [5, 7.2, 11, 18]) {
          const atteint = sigmaEffectif(rayonFlou(cible, plateforme, ratio), plateforme, ratio);
          expect(Math.abs(atteint - cible)).toBeLessThan(0.55);
        }
      }
    }
  });

  it("vise juste au point de fonctionnement (source 256 px)", () => {
    for (const plateforme of ["ios", "android"] as const) {
      for (const ratio of [1, 2]) {
        const atteint = sigmaEffectif(rayonFlou(7.05, plateforme, ratio), plateforme, ratio);
        expect(Math.abs(atteint - 7.05) / 7.05).toBeLessThan(0.08);
      }
    }
  });

  it("se quantifie grossièrement sous 5 px — la raison de la source en 256", () => {
    // Le noyau de boîte est entier et impair : les σ atteignables sont espacés
    // d'environ 1, donc l'erreur relative du PIRE cas vaut ~0,5/σ. Une source
    // de 128 px viserait σ ≈ 3,5 (14 % dans le pire cas) ; à 256 px on vise
    // ≈ 7 et le pire cas retombe sous 8 %.
    const pire = (a: number, b: number) => {
      let max = 0;
      for (let c = a; c <= b; c += 0.02) {
        const atteint = sigmaEffectif(rayonFlou(c, "ios", 1), "ios", 1);
        max = Math.max(max, Math.abs(atteint - c) / c);
      }
      return max;
    };
    expect(pire(3, 4)).toBeGreaterThan(0.12);
    expect(pire(6.5, 8)).toBeLessThan(0.08);
  });

  it("ramène le σ d'écran dans le bitmap", () => {
    const rampe = rampeHalo(CARTE_TVOS, SPEC);
    const boite = CARTE_TVOS + 2 * rampe.bleed;
    const cible = sigmaSource(rampe.sigma, boite, 256);
    // ~3,1 % de la largeur de l'image — le rapport de la référence.
    expect(cible / 256).toBeCloseTo(RAPPORT / (boite / CARTE_TVOS), 4);
    expect(rayonFlou(cible, "ios", 1)).toBeGreaterThan(10);
    expect(rayonFlou(cible, "ios", 1)).toBeLessThan(20);
  });
});
