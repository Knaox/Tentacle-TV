import { describe, expect, it } from "vitest";
import { chromeInsets } from "../chrome/chromeInsets";
import { BOTTOM_GAP, SIDE_WIDTH, panelLayout } from "./panelLayout";

const phoneLandscape = { width: 852, height: 393, isTablet: false };
const phonePortrait = { width: 393, height: 852, isTablet: false };
const padLandscape = { width: 1194, height: 834, isTablet: true };
const padPortrait = { width: 834, height: 1194, isTablet: true };
const edgesLandscape = chromeInsets({ os: "ios", isTablet: false, landscape: true, insets: { top: 0, right: 59, bottom: 21, left: 59 }, stableTop: 0 });
const edgesPortrait = chromeInsets({ os: "ios", isTablet: false, landscape: false, insets: { top: 59, right: 0, bottom: 34, left: 0 }, stableTop: 59 });
const edgesPad = { top: 30, right: 24, bottom: 20, left: 24 };

describe("disposition des panneaux du lecteur", () => {
  it("menu, téléphone couché : panneau latéral, jamais pleine largeur", () => {
    const frame = panelLayout({ kind: "menu", ...phoneLandscape, edges: edgesLandscape });
    expect(frame.mode).toBe("side");
    expect(frame.left).toBeUndefined();
    expect(frame.width).toBeLessThanOrEqual(SIDE_WIDTH.phone);
    expect(frame.width!).toBeLessThan(phoneLandscape.width / 2);
    expect(frame.right).toBe(edgesLandscape.right);
  });

  it("menu, téléphone couché : il tient dans la hauteur utile", () => {
    const frame = panelLayout({ kind: "menu", ...phoneLandscape, edges: edgesLandscape });
    expect(frame.maxHeight).toBe(phoneLandscape.height - edgesLandscape.top - edgesLandscape.bottom);
  });

  it("menu, téléphone debout : carte flottante en bas, l'image reste visible au-dessus", () => {
    const frame = panelLayout({ kind: "menu", ...phonePortrait, edges: edgesPortrait });
    expect(frame.mode).toBe("bottom");
    expect(frame.left).toBe(BOTTOM_GAP);
    expect(frame.bottom).toBe(34);
    expect(frame.maxHeight).toBeLessThan(phonePortrait.height * 0.65);
  });

  it("menu, iPad (les deux sens) : panneau latéral", () => {
    expect(panelLayout({ kind: "menu", ...padLandscape, edges: edgesPad }).mode).toBe("side");
    const portrait = panelLayout({ kind: "menu", ...padPortrait, edges: edgesPad });
    expect(portrait.mode).toBe("side");
    expect(portrait.width).toBe(SIDE_WIDTH.tablet);
  });

  it("épisodes, téléphone couché et iPad : étagère en bas, sur la largeur utile", () => {
    const shelf = panelLayout({ kind: "episodes", ...phoneLandscape, edges: edgesLandscape });
    expect(shelf.mode).toBe("shelf");
    expect(shelf.left).toBe(edgesLandscape.left);
    expect(shelf.maxHeight).toBeLessThan(phoneLandscape.height);
    expect(panelLayout({ kind: "episodes", ...padPortrait, edges: edgesPad }).mode).toBe("shelf");
  });

  it("épisodes, téléphone debout : carte du bas, plus haute qu'un menu", () => {
    const episodes = panelLayout({ kind: "episodes", ...phonePortrait, edges: edgesPortrait });
    const menu = panelLayout({ kind: "menu", ...phonePortrait, edges: edgesPortrait });
    expect(episodes.mode).toBe("bottom");
    expect(episodes.maxHeight).toBeGreaterThan(menu.maxHeight);
  });
});
