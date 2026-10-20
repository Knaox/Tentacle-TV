import { describe, expect, it } from "vitest";
import { CHROME_CORNER, CHROME_EDGE, chromeInsets } from "./chromeInsets";

// Marges sûres relevées sur un iPhone à Dynamic Island.
const islandPortrait = { top: 59, right: 0, bottom: 34, left: 0 };
const islandLandscape = { top: 0, right: 59, bottom: 21, left: 59 };
const sePortrait = { top: 20, right: 0, bottom: 0, left: 0 };
const seLandscape = { top: 0, right: 0, bottom: 0, left: 0 };

describe("marges des commandes du lecteur", () => {
  it("iPhone couché : la barre du haut est EN HAUT, même si la marge du portrait traîne encore", () => {
    const out = chromeInsets({ os: "ios", isTablet: false, landscape: true, insets: islandLandscape, stableTop: 59 });
    expect(out.top).toBeLessThanOrEqual(12);
  });

  it("iPhone couché : côtés à l'écart des coins, pas de l'îlot (≈ 59 pt)", () => {
    const out = chromeInsets({ os: "ios", isTablet: false, landscape: true, insets: islandLandscape, stableTop: 0 });
    expect(out.left).toBe(CHROME_CORNER);
    expect(out.right).toBe(CHROME_CORNER);
    expect(out.left).toBeLessThan(islandLandscape.left);
  });

  it("iPhone couché : le bas reste au-dessus de l'indicateur d'accueil", () => {
    const out = chromeInsets({ os: "ios", isTablet: false, landscape: true, insets: islandLandscape, stableTop: 0 });
    expect(out.bottom).toBe(21);
  });

  it("iPhone debout : sous l'îlot, collé, côtés à l'air minimal", () => {
    const out = chromeInsets({ os: "ios", isTablet: false, landscape: false, insets: islandPortrait, stableTop: 59 });
    expect(out.top).toBeGreaterThanOrEqual(59);
    expect(out.top).toBeLessThanOrEqual(66);
    expect(out.left).toBe(CHROME_EDGE);
    expect(out.bottom).toBe(34);
  });

  it("iPhone SE couché : coins droits, l'air minimal", () => {
    const out = chromeInsets({ os: "ios", isTablet: false, landscape: true, insets: seLandscape, stableTop: 0 });
    expect(out.left).toBe(CHROME_EDGE);
    expect(out.top).toBeLessThanOrEqual(8);
    expect(out.bottom).toBeGreaterThan(0);
  });

  it("iPhone SE debout : sous la barre d'état", () => {
    const out = chromeInsets({ os: "ios", isTablet: false, landscape: false, insets: sePortrait, stableTop: 20 });
    expect(out.top).toBeGreaterThanOrEqual(20);
  });

  it("iPad : sous sa barre d'état, à l'écart des coins arrondis", () => {
    const insets = { top: 24, right: 0, bottom: 20, left: 0 };
    const out = chromeInsets({ os: "ios", isTablet: true, landscape: true, insets, stableTop: 24 });
    expect(out.top).toBeGreaterThanOrEqual(24);
    expect(out.top).toBeLessThanOrEqual(32);
    expect(out.left).toBe(CHROME_CORNER);
    expect(out.bottom).toBe(20);
  });

  it("Android : la découpe de la caméra est suivie du seul côté où elle est", () => {
    const insets = { top: 0, right: 0, bottom: 0, left: 32 };
    const out = chromeInsets({ os: "android", isTablet: false, landscape: true, insets, stableTop: 24 });
    expect(out.left).toBe(32);
    expect(out.right).toBe(CHROME_EDGE);
    expect(out.top).toBeGreaterThanOrEqual(24);
  });
});
