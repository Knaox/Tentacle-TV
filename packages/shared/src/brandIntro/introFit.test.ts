import { describe, expect, it } from "vitest";
import { introCameraPlan } from "./introCamera";
import { fitIntroArt, introFitFor, stretchArmY, INTRO_FIT_INNER_WIDTH } from "./introFit";
import { introGeometry, pathBounds } from "./introGeometry";

/**
 * Un logo de test à la forme des constantes générées (`tentacleArt.generated.ts`) :
 * des bras avant qui longent l'écran et bouclent en bas, des pattes dessous.
 */
const LEFT_ARM = "M 81.5 92.7 L 70 110 L 61 140 L 62 175 L 70 186 L 92 182 L 74 172 L 70 140 L 78 112 Z";
const ART = {
  SCREEN: { x: 58, y: 104, width: 124, height: 92, rx: 16, frameWidth: 5 },
  PLAY_PATH: "M 114 134 L 142 150 L 114 166 Z",
  FRONT_ARM_PATHS: [LEFT_ARM, "M 158.5 92.7 L 170 110 L 179 140 L 178 175 L 170 186 L 148 182 L 166 172 L 170 140 L 162 112 Z"],
  BACK_ARM_PATHS: ["M 84.6 150.4 L 71.6 190 L 80 228 L 92 222 L 84 190 L 96 158 Z", "M 155.4 150.4 L 168.4 190 L 160 228 L 148 222 L 156 190 L 144 158 Z"],
  EYE_WHITES: [{ cx: 99, cy: 82, r: 15.5 }, { cx: 141, cy: 82, r: 15.5 }],
  SUCKERS: [
    { cx: 73.9, cy: 116.2, r: 1.8 },
    { cx: 66.1, cy: 146.3, r: 1.3 },
    { cx: 66.9, cy: 179.6, r: 0.9 },
    { cx: 166.1, cy: 116.2, r: 1.8 },
    { cx: 173.9, cy: 146.3, r: 1.3 },
    { cx: 173.1, cy: 179.6, r: 0.9 },
  ],
  LOGO_GRADIENTS: {
    gV: { x1: 46, y1: 26, x2: 196, y2: 214 },
    gA: { x1: 0, y1: 118, x2: 0, y2: 230 },
    gT: { x1: 0, y1: 104, x2: 0, y2: 196 },
    gP: { x1: 114, y1: 134, x2: 142, y2: 166 },
  },
};

/** Les fenêtres de l'essai : iPhone en portrait et en paysage, iPad dans les deux sens, une TV. */
const IPHONE = { width: 393, height: 852 };
const IPHONE_LANDSCAPE = { width: 852, height: 393 };
const IPAD = { width: 820, height: 1180 };
const IPAD_LANDSCAPE = { width: 1180, height: 820 };

const innerAspectOf = (aspect: number) => {
  const inner = introGeometry(fitIntroArt(ART, aspect)).inner;
  return inner.width / inner.height;
};

describe("l'écran du poulpe aux proportions de l'appareil", () => {
  it("prend le rapport de la fenêtre, quel que soit le format", () => {
    for (const view of [IPHONE, IPHONE_LANDSCAPE, IPAD, IPAD_LANDSCAPE]) {
      expect(innerAspectOf(view.width / view.height)).toBeCloseTo(view.width / view.height, 6);
    }
  });

  it("au rapport du logo (la TV), rien ne change : le même objet", () => {
    const inner = (ART.SCREEN.width - ART.SCREEN.frameWidth) / (ART.SCREEN.height - ART.SCREEN.frameWidth);
    expect(fitIntroArt(ART, inner)).toBe(ART);
  });

  it("garde le haut de l'écran (la tête y est posée) et son centre ; la largeur reste bornée", () => {
    for (const aspect of [0.2, IPHONE.width / IPHONE.height, 1, 3]) {
      const fit = introFitFor(ART, aspect);
      expect(fit.screen.y).toBe(ART.SCREEN.y);
      expect(fit.screen.x + fit.screen.width / 2).toBeCloseTo(ART.SCREEN.x + ART.SCREEN.width / 2, 6);
      const inner = fit.screen.width - ART.SCREEN.frameWidth;
      expect(inner).toBeGreaterThanOrEqual(INTRO_FIT_INNER_WIDTH.min - 1e-9);
      expect(inner).toBeLessThanOrEqual(INTRO_FIT_INNER_WIDTH.max + 1e-9);
    }
  });

  it("les bras avant suivent les côtés et descendent jusqu'au bas : leur boucle reste à la même place par rapport au coin", () => {
    const art = fitIntroArt(ART, IPHONE.width / IPHONE.height);
    const fit = introFitFor(ART, IPHONE.width / IPHONE.height);
    ART.FRONT_ARM_PATHS.forEach((d, index) => {
      const before = pathBounds(d);
      const after = pathBounds(art.FRONT_ARM_PATHS[index] as string);
      const side = index === 0 ? 1 : -1;
      expect(after.x).toBeCloseTo(before.x + side * fit.inset, 1);
      // Le bas de la boucle reste à la même distance du bas de l'écran.
      const bottom = ART.SCREEN.y + ART.SCREEN.height;
      expect(after.y + after.height - (bottom + fit.grow)).toBeCloseTo(before.y + before.height - bottom, 1);
      // L'épaule ne bouge pas : elle part de la tête.
      expect(after.y).toBeCloseTo(before.y, 1);
    });
  });

  it("les pattes arrière suivent le bas de l'écran ; le bouton lecture reste en son centre", () => {
    const aspect = IPAD.width / IPAD.height;
    const art = fitIntroArt(ART, aspect);
    const fit = introFitFor(ART, aspect);
    ART.BACK_ARM_PATHS.forEach((d, index) => {
      expect(pathBounds(art.BACK_ARM_PATHS[index] as string).y).toBeCloseTo(pathBounds(d).y + fit.grow, 1);
    });
    const geometry = introGeometry(art);
    expect(geometry.play.y).toBeCloseTo(geometry.target.y, 0);
    expect(geometry.play.y - geometry.target.y).toBeCloseTo(introGeometry(ART).play.y - introGeometry(ART).target.y, 1);
  });

  it("les ventouses suivent leur bras", () => {
    const art = fitIntroArt(ART, IPHONE.width / IPHONE.height);
    art.SUCKERS.forEach((cup, index) => {
      const bounds = pathBounds(art.FRONT_ARM_PATHS[(ART.SUCKERS[index] as { cx: number }).cx < 120 ? 0 : 1] as string);
      expect(cup.cx).toBeGreaterThanOrEqual(bounds.x);
      expect(cup.cx).toBeLessThanOrEqual(bounds.x + bounds.width);
      expect(cup.cy).toBeGreaterThanOrEqual(bounds.y);
      expect(cup.cy).toBeLessThanOrEqual(bounds.y + bounds.height);
    });
  });

  it("le tronçon droit s'étire sans rompre le tracé, même sur un paysage très large", () => {
    for (const grow of [-80, -20, 0, 40, 200]) {
      let previous = -Infinity;
      for (let y = 80; y <= 240; y += 0.5) {
        const mapped = stretchArmY(y, grow);
        expect(mapped).toBeGreaterThan(previous);
        previous = mapped;
      }
    }
  });
});

describe("le cadrage : la fenêtre ENTIÈRE à l'arrivée, la zone sûre au départ", () => {
  it("à l'arrivée, l'app recouvre l'écran sans bandes : l'intérieur ne dépasse la fenêtre que de sa marge", () => {
    const aspect = IPHONE.width / IPHONE.height;
    const fitted = introGeometry(fitIntroArt(ART, aspect));
    const plan = introCameraPlan(IPHONE.width, IPHONE.height, fitted);
    expect((fitted.inner.width * plan.to.zoom) / IPHONE.width).toBeLessThan(1.2);
    // L'écran de TV d'origine aurait laissé deux bandes plus larges que le téléphone.
    const tv = introGeometry(ART);
    expect((tv.inner.width * introCameraPlan(IPHONE.width, IPHONE.height, tv).to.zoom) / IPHONE.width).toBeGreaterThan(2.5);
  });

  it("au départ, le logo entier se centre dans la zone sûre (encoche, Dynamic Island, barre d'accueil)", () => {
    const geometry = introGeometry(fitIntroArt(ART, IPHONE.width / IPHONE.height));
    const bare = introCameraPlan(IPHONE.width, IPHONE.height, geometry);
    const safe = introCameraPlan(IPHONE.width, IPHONE.height, geometry, { top: 59, right: 0, bottom: 34, left: 0 });
    expect(safe.from.offsetY - bare.from.offsetY).toBeCloseTo((59 - 34) / 2, 6);
    expect(safe.to).toEqual(bare.to);
    // Le logo allongé tient en entier : sa hauteur à l'écran reste dans la zone sûre.
    expect(geometry.logo.units * safe.from.zoom).toBeLessThanOrEqual(IPHONE.height - 59 - 34);
  });

  it("sans zone sûre ni adaptation, le cadrage de la TV est inchangé", () => {
    const geometry = introGeometry(ART);
    expect(geometry.logo).toEqual({ center: { x: 120, y: 122 }, units: 240 });
    expect(introCameraPlan(1920, 1080, geometry)).toEqual(introCameraPlan(1920, 1080, geometry, { top: 0, right: 0, bottom: 0, left: 0 }));
  });
});
