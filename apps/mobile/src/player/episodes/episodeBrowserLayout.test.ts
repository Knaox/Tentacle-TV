import { describe, expect, it } from "vitest";
import { indexGeometry, openCardAt, openCardPlace, panelGeometry, shelfContentHeight, shelfGeometry, videoRect, type BrowserScreen } from "./episodeBrowserLayout";

const NONE = { top: 0, right: 0, bottom: 0, left: 0 };

// iPhone 17 Pro, debout puis couché ; iPad Pro 11 pouces, debout puis couché.
const PHONE_PORTRAIT: BrowserScreen = { width: 402, height: 874, isTablet: false, edges: { top: 62, right: 16, bottom: 34, left: 16 }, safe: { top: 62, right: 0, bottom: 34, left: 0 } };
const PHONE_LANDSCAPE: BrowserScreen = { width: 874, height: 402, isTablet: false, edges: { top: 10, right: 24, bottom: 21, left: 24 }, safe: { top: 0, right: 62, bottom: 21, left: 62 } };
const PAD_PORTRAIT: BrowserScreen = { width: 834, height: 1210, isTablet: true, edges: { top: 30, right: 16, bottom: 20, left: 16 }, safe: { top: 24, right: 0, bottom: 20, left: 0 } };
const PAD_LANDSCAPE: BrowserScreen = { width: 1210, height: 834, isTablet: true, edges: { top: 30, right: 16, bottom: 20, left: 16 }, safe: { top: 24, right: 0, bottom: 20, left: 0 } };

const video = (screen: BrowserScreen) => videoRect(screen.width, screen.height);

describe("videoRect", () => {
  it("une image 16:9 en bande au milieu d'un téléphone debout", () => {
    expect(videoRect(402, 874)).toEqual({ x: 0, y: 324, width: 402, height: 226 });
  });

  it("des bandes sur les côtés d'un téléphone couché", () => {
    const rect = videoRect(874, 402);
    expect(rect.height).toBe(402);
    expect(rect.x).toBeGreaterThan(0);
  });
});

describe("shelfGeometry", () => {
  it("debout, l'étagère se pose sous l'image sans la couvrir", () => {
    const rect = video(PHONE_PORTRAIT);
    const geo = shelfGeometry(PHONE_PORTRAIT, rect);
    expect(geo.belowVideo).toBe(true);
    expect(geo.top).toBeGreaterThanOrEqual(rect.y + rect.height);
    expect(geo.top + shelfContentHeight(false, geo.thumbHeight, geo.overviewLines)).toBeLessThanOrEqual(PHONE_PORTRAIT.height - geo.bottom);
  });

  it("debout, la carte suivante dépasse : on voit que ça défile", () => {
    const geo = shelfGeometry(PHONE_PORTRAIT, video(PHONE_PORTRAIT));
    expect(geo.inset + geo.cardWidth).toBeLessThan(PHONE_PORTRAIT.width - 40);
  });

  it("couché, sur l'image, en laissant voir plus du tiers du haut", () => {
    const geo = shelfGeometry(PHONE_LANDSCAPE, video(PHONE_LANDSCAPE));
    expect(geo.belowVideo).toBe(false);
    expect(geo.top).toBeGreaterThan(PHONE_LANDSCAPE.height / 3);
    expect(geo.inset).toBeGreaterThanOrEqual(PHONE_LANDSCAPE.edges.left);
  });

  it("l'iPad couché garde le résumé sous le titre", () => {
    expect(shelfGeometry(PAD_LANDSCAPE, video(PAD_LANDSCAPE)).overviewLines).toBe(2);
  });
});

describe("panelGeometry", () => {
  it("couché, une colonne à droite, à l'écart de l'îlot", () => {
    const geo = panelGeometry(PHONE_LANDSCAPE, video(PHONE_LANDSCAPE));
    expect(geo.mode).toBe("side");
    expect(geo.right).toBeGreaterThanOrEqual(PHONE_LANDSCAPE.safe.right - 8);
    expect(geo.left).toBeGreaterThan(PHONE_LANDSCAPE.width / 3);
  });

  it("debout, l'image monte sous la barre d'état et la feuille commence sous elle", () => {
    const rect = video(PHONE_PORTRAIT);
    const geo = panelGeometry(PHONE_PORTRAIT, rect);
    expect(geo.mode).toBe("sheet");
    expect(rect.y - geo.videoLift).toBe(PHONE_PORTRAIT.safe.top);
    expect(geo.top).toBeGreaterThan(rect.y + rect.height - geo.videoLift);
  });

  it("l'iPad debout fait de même", () => {
    const geo = panelGeometry(PAD_PORTRAIT, video(PAD_PORTRAIT));
    expect(geo.mode).toBe("sheet");
    expect(geo.videoLift).toBeGreaterThan(0);
  });
});

describe("indexGeometry", () => {
  it("deux colonnes couché, une debout", () => {
    expect(indexGeometry(PHONE_LANDSCAPE).columns).toBe(2);
    expect(indexGeometry(PHONE_PORTRAIT).columns).toBe(1);
    expect(indexGeometry(PAD_LANDSCAPE).columns).toBe(2);
  });

  it("le contenu plein écran évite l'îlot et l'indicateur d'accueil", () => {
    const geo = indexGeometry(PHONE_LANDSCAPE);
    expect(geo.padding.left).toBeGreaterThanOrEqual(62);
    expect(geo.padding.right).toBeGreaterThanOrEqual(62);
    expect(indexGeometry({ ...PHONE_PORTRAIT, safe: NONE }).padding.bottom).toBeGreaterThan(0);
  });
});

describe("la carte qui s'ouvre", () => {
  const STEP = 132;
  it("posée au retrait, la carte est ouverte et ses suivantes poussées de la différence", () => {
    expect(openCardPlace(3, 3, STEP, 120, 200)).toEqual({ left: 3 * STEP, width: 200, scale: 1 });
    expect(openCardPlace(4, 3, STEP, 120, 200).left).toBe(4 * STEP + 80);
    expect(openCardPlace(2, 3, STEP, 120, 200).width).toBeCloseTo(120);
  });

  it("à mi-chemin, deux cartes à moitié ouvertes, jamais l'une sur l'autre", () => {
    const a = openCardPlace(3, 3.5, STEP, 120, 200);
    const b = openCardPlace(4, 3.5, STEP, 120, 200);
    expect(a.width).toBeCloseTo(160);
    expect(b.left).toBeGreaterThanOrEqual(a.left + a.width);
  });

  it("le toucher rend la carte sous le doigt, rien entre deux", () => {
    expect(openCardAt(3 * STEP + 150, 3, STEP, 120, 200, 12)).toBe(3);
    expect(openCardAt(3 * STEP + 205, 3, STEP, 120, 200, 12)).toBeNull();
    expect(openCardAt(4 * STEP + 80 + 10, 3, STEP, 120, 200, 12)).toBe(4);
    expect(openCardAt(99 * STEP, 3, STEP, 120, 200, 12)).toBeNull();
  });
});
