import { describe, expect, it } from "vitest";
import { chromeInsets } from "../chrome/chromeInsets";
import { BOTTOM_GAP, SIDE_WIDTH, panelLayout } from "./panelLayout";

const phoneLandscape = { width: 852, height: 393, isTablet: false };
const phonePortrait = { width: 393, height: 852, isTablet: false };
const padLandscape = { width: 1194, height: 834, isTablet: true };
const padPortrait = { width: 834, height: 1194, isTablet: true };
const insetsLandscape = { top: 0, right: 59, bottom: 21, left: 59 };
const insetsPortrait = { top: 59, right: 0, bottom: 34, left: 0 };
const insetsPad = { top: 24, right: 0, bottom: 20, left: 0 };
const edgesLandscape = chromeInsets({ os: "ios", isTablet: false, landscape: true, insets: insetsLandscape, stableTop: 0 });
const edgesPortrait = chromeInsets({ os: "ios", isTablet: false, landscape: false, insets: insetsPortrait, stableTop: 59 });
const edgesPad = { top: 30, right: 24, bottom: 20, left: 24 };

describe("disposition des panneaux du lecteur", () => {
  it("menu, téléphone couché : panneau latéral, jamais pleine largeur", () => {
    const frame = panelLayout({ kind: "menu", ...phoneLandscape, edges: edgesLandscape, insets: insetsLandscape });
    expect(frame.mode).toBe("side");
    expect(frame.left).toBeUndefined();
    expect(frame.width).toBeLessThanOrEqual(SIDE_WIDTH.phone);
    expect(frame.width!).toBeLessThan(phoneLandscape.width / 2);
  });

  it("menu, téléphone couché : à l'écart de l'îlot, qui peut être de son côté", () => {
    const frame = panelLayout({ kind: "menu", ...phoneLandscape, edges: edgesLandscape, insets: insetsLandscape });
    expect(frame.right).toBe(59);
  });

  it("menu, téléphone couché : entre la rangée du haut et les outils du bas", () => {
    const frame = panelLayout({ kind: "menu", ...phoneLandscape, edges: edgesLandscape, insets: insetsLandscape });
    expect(frame.bottom).toBeGreaterThan(edgesLandscape.bottom + 40);
    const top = phoneLandscape.height - frame.bottom - frame.maxHeight;
    expect(top).toBeGreaterThan(edgesLandscape.top + 36);
  });

  it("menu, téléphone debout : carte flottante en bas, l'image reste visible au-dessus", () => {
    const frame = panelLayout({ kind: "menu", ...phonePortrait, edges: edgesPortrait, insets: insetsPortrait });
    expect(frame.mode).toBe("bottom");
    expect(frame.left).toBe(BOTTOM_GAP);
    expect(frame.bottom).toBe(34);
    expect(frame.maxHeight).toBeLessThan(phonePortrait.height * 0.65);
  });

  it("menu, iPad (les deux sens) : panneau latéral", () => {
    expect(panelLayout({ kind: "menu", ...padLandscape, edges: edgesPad, insets: insetsPad }).mode).toBe("side");
    const portrait = panelLayout({ kind: "menu", ...padPortrait, edges: edgesPad, insets: insetsPad });
    expect(portrait.mode).toBe("side");
    expect(portrait.width).toBe(SIDE_WIDTH.tablet);
  });

  it("épisodes, téléphone couché et iPad : étagère en bas, sur la largeur utile", () => {
    const shelf = panelLayout({ kind: "episodes", ...phoneLandscape, edges: edgesLandscape, insets: insetsLandscape });
    expect(shelf.mode).toBe("shelf");
    // L'étagère monte au milieu de la hauteur : elle évite l'îlot, pas seulement les coins.
    expect(shelf.left).toBe(59);
    expect(shelf.maxHeight).toBeLessThan(phoneLandscape.height);
    expect(panelLayout({ kind: "episodes", ...padPortrait, edges: edgesPad, insets: insetsPad }).mode).toBe("shelf");
  });

  it("épisodes, téléphone debout : carte du bas, plus haute qu'un menu", () => {
    const episodes = panelLayout({ kind: "episodes", ...phonePortrait, edges: edgesPortrait, insets: insetsPortrait });
    const menu = panelLayout({ kind: "menu", ...phonePortrait, edges: edgesPortrait, insets: insetsPortrait });
    expect(episodes.mode).toBe("bottom");
    expect(episodes.maxHeight).toBeGreaterThan(menu.maxHeight);
  });
});
