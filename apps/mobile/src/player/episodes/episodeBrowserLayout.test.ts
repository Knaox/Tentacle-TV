import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import {
  openCardAt, openCardPlace, openDetailsHeight, openIndexAt, openShelfGeometry, rowTrailingPadding, videoAspectOf, videoRect, type BrowserScreen,
} from "./episodeBrowserLayout";

// iPhone 17 Pro, debout puis couché ; iPad Pro 11 pouces, debout puis couché.
const PHONE_PORTRAIT: BrowserScreen = { width: 402, height: 874, isTablet: false, edges: { top: 62, right: 16, bottom: 34, left: 16 }, safe: { top: 62, right: 0, bottom: 34, left: 0 } };
const PHONE_LANDSCAPE: BrowserScreen = { width: 874, height: 402, isTablet: false, edges: { top: 10, right: 24, bottom: 21, left: 24 }, safe: { top: 0, right: 62, bottom: 21, left: 62 } };
const PAD_PORTRAIT: BrowserScreen = { width: 834, height: 1210, isTablet: true, edges: { top: 30, right: 16, bottom: 20, left: 16 }, safe: { top: 24, right: 0, bottom: 20, left: 0 } };
const PAD_LANDSCAPE: BrowserScreen = { width: 1210, height: 834, isTablet: true, edges: { top: 30, right: 16, bottom: 20, left: 16 }, safe: { top: 24, right: 0, bottom: 20, left: 0 } };
// iPad mini, debout : le moins de noir sous l'image.
const PAD_MINI: BrowserScreen = { width: 744, height: 1133, isTablet: true, edges: { top: 30, right: 16, bottom: 20, left: 16 }, safe: { top: 24, right: 0, bottom: 20, left: 0 } };

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

describe("videoAspectOf", () => {
  const withVideo = (width: number, height: number) => ({ MediaStreams: [{ Type: "Video", Width: width, Height: height }] }) as unknown as MediaItem;

  it("le format du flux vidéo, celui de la source d'abord", () => {
    expect(videoAspectOf(withVideo(1920, 804))).toBeCloseTo(2.388, 2);
    const sourced = { MediaSources: [{ MediaStreams: [{ Type: "Video", Width: 1440, Height: 1080 }] }], MediaStreams: [] } as unknown as MediaItem;
    expect(videoAspectOf(sourced)).toBeCloseTo(4 / 3);
  });

  it("16:9 quand le titre ne dit rien, ou dit n'importe quoi", () => {
    expect(videoAspectOf(undefined)).toBeCloseTo(16 / 9);
    expect(videoAspectOf(withVideo(0, 0))).toBeCloseTo(16 / 9);
    expect(videoAspectOf(withVideo(100, 1000))).toBeCloseTo(16 / 9);
  });
});

describe("openShelfGeometry", () => {
  it.each([
    ["un téléphone", PHONE_PORTRAIT, 40],
    ["un iPad", PAD_PORTRAIT, 46],
    ["un iPad mini", PAD_MINI, 46],
  ] as const)("debout, sur %s, la rangée se pose sous l'image sans la couvrir", (_name, screen, tabs) => {
    const rect = video(screen);
    const geo = openShelfGeometry(screen, rect);
    expect(geo.belowVideo).toBe(true);
    expect(geo.top).toBeGreaterThanOrEqual(rect.y + rect.height);
    const content = tabs + 12 + geo.openHeight + 12 + openDetailsHeight(screen.isTablet, geo.titleLines, geo.overviewLines);
    expect(geo.top + content).toBeLessThanOrEqual(screen.height - geo.bottom);
  });

  it("debout, la carte rétrécit d'un dixième au plus plutôt que de couvrir l'image", () => {
    const pad = openShelfGeometry(PAD_PORTRAIT, video(PAD_PORTRAIT));
    expect(pad.openWidth).toBeLessThan(300);
    expect(pad.openWidth).toBeGreaterThanOrEqual(270);
    expect(pad.restWidth).toBe(Math.round(pad.openWidth * 0.6));
    // Le mini n'a la place que d'une ligne de résumé : la carte garde presque sa taille.
    const mini = openShelfGeometry(PAD_MINI, video(PAD_MINI));
    expect(mini.overviewLines).toBe(1);
    expect(mini.openWidth).toBeGreaterThanOrEqual(270);
  });

  it("couché, sur l'image, à l'écart de l'îlot et en laissant voir le haut", () => {
    const geo = openShelfGeometry(PHONE_LANDSCAPE, video(PHONE_LANDSCAPE));
    expect(geo.belowVideo).toBe(false);
    expect(geo.inset).toBeGreaterThanOrEqual(PHONE_LANDSCAPE.safe.left);
    // Les captures validées le 21/10 : près d'un tiers de l'image reste au-dessus des saisons.
    expect(geo.top).toBeGreaterThan(PHONE_LANDSCAPE.height * 0.3);
    expect(geo.titleLines).toBe(1);
  });

  it("l'iPad garde deux lignes de résumé, debout comme couché, et un titre sur une ligne", () => {
    for (const screen of [PAD_PORTRAIT, PAD_LANDSCAPE]) {
      const geo = openShelfGeometry(screen, video(screen));
      expect(geo.overviewLines).toBe(2);
      expect(geo.titleLines).toBe(1);
    }
  });

  it("une image plus large laisse plus de place dessous : la rangée y tient toujours", () => {
    const wide = videoRect(PHONE_PORTRAIT.width, PHONE_PORTRAIT.height, 2.39);
    expect(openShelfGeometry(PHONE_PORTRAIT, wide).belowVideo).toBe(true);
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

  it("la carte ouverte est la plus proche du retrait, jamais hors de la saison", () => {
    expect(openIndexAt(3.4, 12)).toBe(3);
    expect(openIndexAt(3.6, 12)).toBe(4);
    expect(openIndexAt(-0.8, 12)).toBe(0);
    expect(openIndexAt(14, 12)).toBe(11);
    expect(openIndexAt(2, 0)).toBe(0);
  });

  it("le toucher rend la carte sous le doigt, rien entre deux", () => {
    expect(openCardAt(3 * STEP + 150, 3, STEP, 120, 200, 12)).toBe(3);
    expect(openCardAt(3 * STEP + 205, 3, STEP, 120, 200, 12)).toBeNull();
    expect(openCardAt(4 * STEP + 80 + 10, 3, STEP, 120, 200, 12)).toBe(4);
    expect(openCardAt(99 * STEP, 3, STEP, 120, 200, 12)).toBeNull();
  });
});

describe("la fin de la rangée", () => {
  // Ce que la rangée peut défiler : son contenu (cellules au REPOS, écarts, marges) moins l'écran.
  const maxScroll = (screen: BrowserScreen, count: number) => {
    const geo = openShelfGeometry(screen, video(screen));
    const step = geo.restWidth + 12;
    const content = geo.inset + count * geo.restWidth + (count - 1) * 12 + rowTrailingPadding(screen.width, geo.inset, geo.restWidth);
    return { max: content - screen.width, step };
  };

  for (const [name, screen] of [["téléphone debout", PHONE_PORTRAIT], ["téléphone couché", PHONE_LANDSCAPE], ["iPad debout", PAD_PORTRAIT], ["iPad couché", PAD_LANDSCAPE]] as const) {
    it(`${name} : le dernier épisode s'ouvre au retrait (trois épisodes, le troisième en cours)`, () => {
      const { max, step } = maxScroll(screen, 3);
      expect(max).toBeGreaterThanOrEqual(2 * step);
      expect(openIndexAt(Math.min(max, 2 * step) / step, 3)).toBe(2);
    });
  }
});
