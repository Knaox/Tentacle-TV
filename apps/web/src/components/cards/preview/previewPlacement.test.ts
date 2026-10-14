import { describe, expect, it } from "vitest";
import {
  PREVIEW_COVER_PX,
  PREVIEW_MARGIN,
  PREVIEW_PANEL_MIN,
  PREVIEW_MAX_WIDTH,
  PREVIEW_MIN_WIDTH,
  placePreview,
  previewFromTransform,
  type PreviewPlacement,
  type PreviewRect,
} from "./previewPlacement";

/**
 * La place de la mini-carte. Mesures réelles du bureau : une affiche de
 * rangée « md » en 1440 × 900 fait ~200 × 300 px, une vignette d'épisode
 * ~340 × 191 ; la barre du haut finit à 68 px.
 */
const VIEWPORT = { width: 1440, height: 900, safeTop: 68 };
const poster = (left: number, top = 300, width = 200): PreviewRect => ({ left, top, width, height: width * 1.5 });
const landscape = (left: number, top = 300, width = 340): PreviewRect => ({ left, top, width, height: (width * 9) / 16 });

function inside(p: PreviewPlacement, viewport: { width: number; height: number; safeTop?: number }) {
  expect(p.left).toBeGreaterThanOrEqual(PREVIEW_MARGIN);
  expect(p.left + p.width).toBeLessThanOrEqual(viewport.width - PREVIEW_MARGIN);
  expect(p.top).toBeGreaterThanOrEqual(Math.max(PREVIEW_MARGIN, (viewport.safeTop ?? 0) + PREVIEW_MARGIN));
  expect(p.top + p.height).toBeLessThanOrEqual(viewport.height - PREVIEW_MARGIN);
}

describe("placePreview — taille", () => {
  it("donne à une affiche 2:3 une vidéo 16:9 de 1,75 fois sa largeur, et un bandeau dessous", () => {
    const p = placePreview(poster(600), "poster", VIEWPORT);
    expect(p?.width).toBe(350);
    expect(p?.videoHeight).toBe(197);
    expect((p?.height ?? 0) - (p?.videoHeight ?? 0)).toBeGreaterThanOrEqual(PREVIEW_PANEL_MIN);
  });

  it("COUVRE l'affiche : plus haute qu'elle, sans trou ni voisine qui dépasse en haut ou en bas", () => {
    const card = poster(600);
    const p = placePreview(card, "poster", VIEWPORT);
    expect(p).not.toBeNull();
    if (!p) return;
    expect(p.top).toBeLessThanOrEqual(card.top - PREVIEW_COVER_PX + 1);
    expect(p.top + p.height).toBeGreaterThanOrEqual(card.top + card.height + PREVIEW_COVER_PX - 1);
    expect(p.left).toBeLessThan(card.left);
    expect(p.left + p.width).toBeGreaterThan(card.left + card.width);
  });

  it("une vignette 16:9 reste une vidéo seule, sans bandeau", () => {
    const p = placePreview(landscape(600), "landscape", VIEWPORT);
    expect(p?.videoHeight).toBe(p?.height);
  });

  it("donne à une vignette 16:9 un 16:9 de 1,35 fois sa largeur", () => {
    const p = placePreview(landscape(600), "landscape", VIEWPORT);
    expect(p?.width).toBe(459);
    expect(p?.height).toBe(258);
  });

  it("ne descend pas sous le plancher (affiche étroite) ni ne passe le plafond (grande vignette)", () => {
    expect(placePreview(poster(600, 300, 137), "poster", VIEWPORT)?.width).toBe(PREVIEW_MIN_WIDTH);
    expect(placePreview(landscape(400, 300, 520), "landscape", VIEWPORT)?.width).toBe(PREVIEW_MAX_WIDTH);
  });

  it("garde le 16:9 quand la fenêtre est trop étroite : c'est la taille qui cède, jamais le format", () => {
    const narrow = { width: 300, height: 900 };
    const p = placePreview(poster(40, 300, 200), "poster", narrow);
    expect(p?.width).toBe(300 - 2 * PREVIEW_MARGIN);
    expect(Math.abs((p?.width ?? 0) / (p?.videoHeight ?? 1) - 16 / 9)).toBeLessThan(0.02);
    if (p) inside(p, narrow);
  });

  it("cède aussi à une fenêtre trop basse", () => {
    const low = { width: 1440, height: 200, safeTop: 0 };
    const p = placePreview(landscape(600, 20, 400), "landscape", low);
    expect(p?.height).toBe(200 - 2 * PREVIEW_MARGIN);
    if (p) inside(p, low);
  });

  it("ne place rien sans carte mesurable ni place", () => {
    expect(placePreview({ left: 0, top: 0, width: 0, height: 0 }, "poster", VIEWPORT)).toBeNull();
    expect(placePreview(poster(10), "poster", { width: 20, height: 20 })).toBeNull();
  });
});

describe("placePreview — position", () => {
  it("se centre sur la carte quand la place le permet", () => {
    const card = poster(600);
    const p = placePreview(card, "poster", VIEWPORT);
    expect(p).not.toBeNull();
    if (!p) return;
    // Au pixel près : la boîte est arrondie pour garder son texte net.
    expect(Math.abs(p.left + p.width / 2 - (card.left + card.width / 2))).toBeLessThanOrEqual(1);
    expect(Math.abs(p.top + p.height / 2 - (card.top + card.height / 2))).toBeLessThanOrEqual(1);
    expect(Math.abs(p.from.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(p.from.y)).toBeLessThanOrEqual(1);
  });

  it("grandit vers l'intérieur au bord gauche, sans quitter la marge", () => {
    const card = poster(20);
    const p = placePreview(card, "poster", VIEWPORT);
    expect(p?.left).toBe(PREVIEW_MARGIN);
    // Le départ reste sur la carte : la translation ramène le centre à gauche.
    expect(p?.from.x).toBeLessThan(0);
    if (p) inside(p, VIEWPORT);
  });

  it("grandit vers l'intérieur au bord droit", () => {
    const card = poster(1440 - 40);
    const p = placePreview(card, "poster", VIEWPORT);
    expect((p?.left ?? 0) + (p?.width ?? 0)).toBe(1440 - PREVIEW_MARGIN);
    expect(p?.from.x).toBeGreaterThan(0);
    if (p) inside(p, VIEWPORT);
  });

  it("reste sous la barre du haut et au-dessus du bas de la fenêtre", () => {
    const high = placePreview(landscape(600, 40), "landscape", VIEWPORT);
    expect(high?.top).toBe(68 + PREVIEW_MARGIN);
    const low = placePreview(landscape(600, 860), "landscape", VIEWPORT);
    expect((low?.top ?? 0) + (low?.height ?? 0)).toBe(900 - PREVIEW_MARGIN);
    if (high) inside(high, VIEWPORT);
    if (low) inside(low, VIEWPORT);
  });

  it("place une carte à moitié sortie de la fenêtre dans la fenêtre", () => {
    const p = placePreview(poster(-120), "poster", VIEWPORT);
    if (p) inside(p, VIEWPORT);
    expect(p?.left).toBe(PREVIEW_MARGIN);
  });
});

describe("placePreview — départ de l'animation", () => {
  it("recouvre exactement une vignette 16:9 : même format, échelle uniforme", () => {
    const card = landscape(600);
    const p = placePreview(card, "landscape", VIEWPORT);
    expect(p).not.toBeNull();
    if (!p) return;
    expect(p.width * p.from.scale).toBeCloseTo(card.width, 0);
    expect(p.height * p.from.scale).toBeCloseTo(card.height, 0);
  });

  it("prend la largeur d'une affiche, au milieu de sa hauteur — jamais plus haut qu'elle", () => {
    const card = poster(600);
    const p = placePreview(card, "poster", VIEWPORT);
    expect(p).not.toBeNull();
    if (!p) return;
    expect(p.width * p.from.scale).toBeCloseTo(card.width, 0);
    expect(p.height * p.from.scale).toBeLessThan(card.height);
  });

  it("ne rétrécit jamais en entrant, même quand la carte est plus grande que la place", () => {
    const p = placePreview(landscape(0, 0, 1400), "landscape", { width: 600, height: 400 });
    expect(p?.from.scale).toBe(1);
  });

  it("s'écrit en une transformation CSS composée, sans notation exponentielle", () => {
    expect(previewFromTransform({ x: -12.346, y: 0, scale: 0.5555555 })).toBe("translate(-12.35px, 0px) scale(0.5556)");
  });
});
