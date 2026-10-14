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

  it("Retina, la plus petite (300 × 169) : 360p suffit ; densité 1, 560 px : 360p aussi", () => {
    expect(WIDE[capLevelFor(WIDE, { width: 300, height: 169 }, 2)].height).toBe(360);
    expect(WIDE[capLevelFor(WIDE, { width: 560, height: 315 }, 1)].height).toBe(360);
  });

  it("à 10 % près : un niveau à peine plus petit que la boîte la couvre, pas au-delà", () => {
    // 700 × 394 px d'écran : la 640 × 360 a 8,6 % de moins, elle couvre ; 720 × 406 (11 %), non.
    expect(WIDE[capLevelFor(WIDE, { width: 350, height: 197 }, 2)].height).toBe(360);
    expect(WIDE[capLevelFor(WIDE, { width: 360, height: 203 }, 2)].height).toBe(720);
  });

  it("une 2,39:1 en `cover` doit avoir la HAUTEUR de la boîte ; une 4:3, sa LARGEUR", () => {
    expect(SCOPE[capLevelFor(SCOPE, { width: 560, height: 315 }, 2)].height).toBe(804);
    expect(ACADEMY[capLevelFor(ACADEMY, { width: 560, height: 315 }, 2)].height).toBe(1080);
    expect(ACADEMY[capLevelFor(ACADEMY, { width: 500, height: 281 }, 2)].height).toBe(720);
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
