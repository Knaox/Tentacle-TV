import { describe, expect, it } from "vitest";
import { ACTIVITY_SPINNER, SPINNER_LAYOUT_BOX, spinnerAlphas } from "./activitySpinner";

/**
 * Le relevé de référence : la luminance moyenne de chaque rayon (blanc sur
 * noir, 0-255), image par image (toutes les 50 ms), de l'indicateur `.large`
 * du simulateur tvOS 26 en 1080p — vidéo de `simctl io recordVideo`,
 * 2026-10-05. Le premier relevé tombe à l'image 12 du modèle (rayon 6 éclairé).
 */
const TVOS_FRAMES = [
  [68, 69, 69, 107, 143, 182, 217, 69],
  [69, 69, 69, 88, 125, 162, 199, 70],
  [69, 69, 69, 69, 106, 143, 179, 216],
  [69, 69, 69, 69, 88, 125, 161, 199],
  [218, 69, 69, 69, 69, 106, 141, 180],
  [198, 69, 69, 69, 69, 87, 123, 162],
  [180, 215, 69, 69, 69, 70, 105, 144],
  [161, 198, 69, 69, 69, 70, 86, 125],
  [143, 181, 216, 69, 69, 69, 68, 106],
  [125, 163, 199, 69, 69, 70, 68, 87],
  [106, 144, 179, 214, 69, 70, 67, 69],
  [88, 126, 161, 197, 69, 70, 67, 69],
  [69, 107, 142, 180, 216, 70, 67, 69],
  [69, 88, 124, 162, 198, 70, 67, 69],
  [69, 69, 106, 143, 180, 217, 68, 69],
  [69, 69, 87, 125, 161, 199, 68, 69],
];
const FIRST_FRAME = 12;

describe("l'indicateur d'activité de l'Apple TV", () => {
  it("rend, image par image, les opacités relevées sur tvOS (à 4/255 près, compression de la vidéo)", () => {
    TVOS_FRAMES.forEach((measured, i) => {
      const model = spinnerAlphas((FIRST_FRAME + i) * ACTIVITY_SPINNER.frameMs + 1).map((alpha) => alpha * 255);
      model.forEach((value, spoke) => expect(Math.abs(value - measured[spoke]), `image ${i}, rayon ${spoke}`).toBeLessThanOrEqual(4));
    });
  });

  it("allume le rayon 0 au départ, avance d'un rayon toutes les 100 ms dans le sens des aiguilles d'une montre", () => {
    const lit = (ms: number) => {
      const alphas = spinnerAlphas(ms);
      return alphas.indexOf(Math.max(...alphas));
    };
    expect([0, 100, 200, 700, 800, 850].map(lit)).toEqual([0, 1, 2, 7, 0, 0]);
  });

  it("ne change qu'aux images de 50 ms, et éteint un rayon en 400 ms jusqu'au repos", () => {
    expect(spinnerAlphas(10)).toEqual(spinnerAlphas(49));
    expect(spinnerAlphas(49)).not.toEqual(spinnerAlphas(50));
    const { restAlpha, litAlpha } = ACTIVITY_SPINNER;
    expect(spinnerAlphas(0)[0]).toBeCloseTo(litAlpha);
    expect(spinnerAlphas(200)[0]).toBeCloseTo((restAlpha + litAlpha) / 2);
    expect(spinnerAlphas(400)[0]).toBeCloseTo(restAlpha);
    expect(spinnerAlphas(750)[0]).toBeCloseTo(restAlpha);
  });

  it("garde la géométrie des deux styles : des gélules du centre au bord du cadre", () => {
    for (const size of ["large", "small"] as const) {
      const g = ACTIVITY_SPINNER[size];
      expect(g.outerRadius).toBe(g.box / 2);
      expect(g.innerRadius).toBeGreaterThan(g.spokeWidth / 2);
      // Le dessin déborde le cadre de mise en page de React Native, comme sur Apple TV.
      expect(g.box).toBeGreaterThan(SPINNER_LAYOUT_BOX[size]);
    }
  });
});
