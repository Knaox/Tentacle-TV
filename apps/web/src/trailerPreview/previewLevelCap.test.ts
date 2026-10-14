/**
 * Le plafond de qualité d'un aperçu : le plus petit niveau qui couvre la
 * mini-carte en pixels de l'écran — jamais une 1080p dans 560 px de Retina.
 */
import { describe, expect, it } from "vitest";
import { FALLBACK_BOX, capLevelFor } from "./previewLevelCap";

// Les niveaux d'un maître du relais, triés comme hls.js les range (hauteur croissante).
const WIDE = [
  { width: 256, height: 144 }, { width: 640, height: 360 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 },
];
const SCOPE = [{ width: 640, height: 268 }, { width: 1280, height: 536 }, { width: 1920, height: 804 }];
const ACADEMY = [{ width: 480, height: 360 }, { width: 960, height: 720 }, { width: 1440, height: 1080 }];

describe("capLevelFor", () => {
  it("Retina, la plus grande mini-carte (560 × 315) : 720p, pas 1080p", () => {
    expect(WIDE[capLevelFor(WIDE, { width: 560, height: 315 }, 2)]).toEqual({ width: 1280, height: 720 });
  });

  it("Retina, une boîte de 300 × 169 (600 × 338 px d'écran) : 360p suffit ; densité 1, 560 px : 360p aussi", () => {
    expect(WIDE[capLevelFor(WIDE, { width: 300, height: 169 }, 2)].height).toBe(360);
    expect(WIDE[capLevelFor(WIDE, { width: 560, height: 315 }, 1)].height).toBe(360);
  });

  it("jamais un niveau agrandi : 331 px sur Retina (662 px d'écran) prend la 720p, pas une 360p étirée de 3 %", () => {
    expect(WIDE[capLevelFor(WIDE, { width: 331, height: 186 }, 2)].height).toBe(720);
    expect(WIDE[capLevelFor(WIDE, { width: 320, height: 180 }, 2)].height).toBe(360);
  });

  it("une 2,39:1 en `cover` doit avoir la HAUTEUR de la boîte ; une 4:3, sa LARGEUR", () => {
    expect(SCOPE[capLevelFor(SCOPE, { width: 560, height: 315 }, 2)].height).toBe(804);
    expect(ACADEMY[capLevelFor(ACADEMY, { width: 560, height: 315 }, 2)].height).toBe(1080);
    expect(ACADEMY[capLevelFor(ACADEMY, { width: 480, height: 270 }, 2)].height).toBe(720);
  });

  it("aucun niveau ne couvre la boîte : le plus grand", () => {
    expect(capLevelFor(WIDE, { width: 1200, height: 675 }, 2)).toBe(3);
  });

  it("élément pas encore posé : la plus grande mini-carte, jamais « sans plafond »", () => {
    expect(capLevelFor(WIDE, { width: 0, height: 0 }, 2)).toBe(capLevelFor(WIDE, FALLBACK_BOX, 2));
  });

  it("sans dimensions (MP4, audio) : pas de plafond", () => {
    expect(capLevelFor([{}, {}], { width: 560, height: 315 }, 2)).toBe(-1);
  });
});
