import { describe, expect, it } from "vitest";
import {
  PREVIEW_COVER_PX,
  PREVIEW_MARGIN,
  PREVIEW_MAX_WIDTH,
  PREVIEW_MIN_WIDTH,
  placePreview,
  previewFromTransform,
  previewPanelHeight,
  previewWidthFor,
  type PreviewPlacement,
  type PreviewRect,
} from "./previewPlacement";

/**
 * La place de la mini-carte. Mesures réelles du bureau : une affiche de
 * rangée « md » en 1440 × 900 fait ~200 × 300 px, une vignette d'épisode
 * ~345 × 194 ; la barre du haut finit à 68 px.
 */
const VIEWPORT = { width: 1440, height: 900, safeTop: 68 };
const poster = (left: number, top = 300, width = 200): PreviewRect => ({ left, top, width, height: width * 1.5 });
const landscape = (left: number, top = 300, width = 345): PreviewRect => ({ left, top, width, height: (width * 9) / 16 });

function inside(p: PreviewPlacement, viewport: { width: number; height: number; safeTop?: number }) {
  expect(p.left).toBeGreaterThanOrEqual(PREVIEW_MARGIN);
  expect(p.left + p.width).toBeLessThanOrEqual(viewport.width - PREVIEW_MARGIN);
  expect(p.top).toBeGreaterThanOrEqual(Math.max(PREVIEW_MARGIN, (viewport.safeTop ?? 0) + PREVIEW_MARGIN));
  expect(p.top + p.height).toBeLessThanOrEqual(viewport.height - PREVIEW_MARGIN);
}

describe("previewPanelHeight — le bandeau suit la largeur", () => {
  it("passe par les trois relevés du dessin, linéaire entre eux", () => {
    expect(previewPanelHeight(288)).toBe(128);
    expect(previewPanelHeight(400)).toBe(156);
    expect(previewPanelHeight(560)).toBe(188);
    expect(previewPanelHeight(344)).toBe(142);
    expect(previewPanelHeight(480)).toBe(172);
  });

  it("reste constant hors de la plage relevée", () => {
    expect(previewPanelHeight(200)).toBe(128);
    expect(previewPanelHeight(900)).toBe(188);
  });
});

describe("previewWidthFor — une taille par fenêtre", () => {
  it("vaut ~23 % de la fenêtre pour une affiche, quelle que soit la densité de la rangée", () => {
    expect(previewWidthFor(200, 1440)).toBeCloseTo(331.2, 1);
    expect(previewWidthFor(140, 1440)).toBeCloseTo(331.2, 1);
    expect(previewWidthFor(200, 1920)).toBeCloseTo(441.6, 1);
  });

  it("donne la MÊME largeur à une affiche et à une vignette qui la laisse grandir", () => {
    expect(previewWidthFor(250, 1440)).toBe(previewWidthFor(200, 1440));
  });

  it("grandit toujours d'au moins 1,2 × la carte : une large vignette passe la part d'écran", () => {
    expect(previewWidthFor(345, 1440)).toBeCloseTo(414, 1);
    expect(previewWidthFor(400, 1920)).toBeCloseTo(480, 1);
  });

  it("tient entre le plancher et le plafond", () => {
    expect(previewWidthFor(187, 1280)).toBe(PREVIEW_MIN_WIDTH);
    expect(previewWidthFor(150, 1024)).toBe(PREVIEW_MIN_WIDTH);
    expect(previewWidthFor(200, 2560)).toBe(PREVIEW_MAX_WIDTH);
    expect(previewWidthFor(520, 2560)).toBe(PREVIEW_MAX_WIDTH);
  });
});

describe("placePreview — taille", () => {
  it("pose la vidéo 16:9 en haut et le bandeau dessous, pour une affiche comme pour une vignette", () => {
    for (const [card, shape] of [[poster(600), "poster"], [landscape(600), "landscape"]] as const) {
      const p = placePreview(card, shape, VIEWPORT);
      expect(p).not.toBeNull();
      if (!p) continue;
      expect(Math.abs(p.width / p.videoHeight - 16 / 9)).toBeLessThan(0.01);
      expect(p.height - p.videoHeight).toBeGreaterThanOrEqual(previewPanelHeight(p.width));
    }
  });

  it("une vignette : exactement vidéo + bandeau", () => {
    const p = placePreview(landscape(600), "landscape", VIEWPORT);
    expect(p?.width).toBe(414);
    expect(p?.videoHeight).toBe(233);
    expect(p?.height).toBe(233 + previewPanelHeight(414));
  });

  it("COUVRE l'affiche : plus haute qu'elle, le bandeau s'allonge", () => {
    const card = poster(600);
    const p = placePreview(card, "poster", VIEWPORT);
    expect(p).not.toBeNull();
    if (!p) return;
    expect(p.width).toBe(331);
    expect(p.top).toBeLessThanOrEqual(card.top - PREVIEW_COVER_PX + 1);
    expect(p.top + p.height).toBeGreaterThanOrEqual(card.top + card.height + PREVIEW_COVER_PX - 1);
    expect(p.left).toBeLessThan(card.left);
    expect(p.left + p.width).toBeGreaterThan(card.left + card.width);
  });

  it("garde le 16:9 quand la fenêtre est trop étroite : c'est la taille qui cède, jamais le format", () => {
    const narrow = { width: 300, height: 900 };
    const p = placePreview(poster(40, 300, 200), "poster", narrow);
    expect(p?.width).toBe(300 - 2 * PREVIEW_MARGIN);
    expect(Math.abs((p?.width ?? 0) / (p?.videoHeight ?? 1) - 16 / 9)).toBeLessThan(0.02);
    if (p) inside(p, narrow);
  });

  it("cède aussi à une fenêtre trop basse : vidéo + bandeau y tiennent", () => {
    const low = { width: 1440, height: 400, safeTop: 68 };
    const p = placePreview(landscape(600, 120, 345), "landscape", low);
    expect(p).not.toBeNull();
    if (!p) return;
    expect(p.width).toBeLessThan(414);
    expect(p.height).toBe(p.videoHeight + previewPanelHeight(p.width));
    inside(p, low);
  });

  it("ne place rien sans carte mesurable ni place", () => {
    expect(placePreview({ left: 0, top: 0, width: 0, height: 0 }, "poster", VIEWPORT)).toBeNull();
    expect(placePreview(poster(10), "poster", { width: 20, height: 20 })).toBeNull();
  });
});

describe("placePreview — position", () => {
  it("se centre sur la carte dans les deux axes quand la place le permet", () => {
    for (const [card, shape] of [[poster(600), "poster"], [landscape(600, 340), "landscape"]] as const) {
      const p = placePreview(card, shape, VIEWPORT);
      expect(p).not.toBeNull();
      if (!p) continue;
      // Au pixel près : la boîte est arrondie pour garder son texte net.
      expect(Math.abs(p.left + p.width / 2 - (card.left + card.width / 2))).toBeLessThanOrEqual(1);
      expect(Math.abs(p.top + p.height / 2 - (card.top + card.height / 2))).toBeLessThanOrEqual(1);
    }
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

  it("tient dans toutes les fenêtres de la recette, affiche et vignette", () => {
    for (const viewport of [
      { width: 1024, height: 700, safeTop: 68 },
      { width: 1280, height: 800, safeTop: 68 },
      { width: 1920, height: 1080, safeTop: 68 },
      { width: 2560, height: 1440, safeTop: 68 },
    ]) {
      for (const [card, shape] of [[poster(viewport.width / 2, 200, 200), "poster"], [landscape(viewport.width / 2, 200, 400), "landscape"]] as const) {
        const p = placePreview(card, shape, viewport);
        expect(p).not.toBeNull();
        if (p) inside(p, viewport);
      }
    }
  });
});

describe("placePreview — départ de l'animation", () => {
  it("pose la VIDÉO exactement sur une vignette 16:9 : même largeur, même centre", () => {
    const card = landscape(600, 340);
    const p = placePreview(card, "landscape", VIEWPORT);
    expect(p).not.toBeNull();
    if (!p) return;
    expect(p.width * p.from.scale).toBeCloseTo(card.width, 0);
    expect(p.videoHeight * p.from.scale).toBeCloseTo(card.height, 0);
    // Le centre de la vidéo, réduite autour du centre de la boîte puis déplacée.
    const videoCenterY = p.top + p.height / 2 + p.from.scale * (p.videoHeight / 2 - p.height / 2) + p.from.y;
    expect(videoCenterY).toBeCloseTo(card.top + card.height / 2, 0);
  });

  it("prend la largeur d'une affiche, au milieu de sa hauteur — jamais plus haut qu'elle", () => {
    const card = poster(600);
    const p = placePreview(card, "poster", VIEWPORT);
    expect(p).not.toBeNull();
    if (!p) return;
    expect(p.width * p.from.scale).toBeCloseTo(card.width, 0);
    expect(p.height * p.from.scale).toBeLessThan(card.height);
  });

  it("une voisine encore écartée : posée sur SA place, partie de là où on la voit", () => {
    const place = poster(600);
    const seen = { ...place, left: place.left + 61 };
    const p = placePreview(place, "poster", VIEWPORT, seen);
    const q = placePreview(place, "poster", VIEWPORT);
    expect(p).not.toBeNull();
    if (!p || !q) return;
    expect({ left: p.left, top: p.top, width: p.width, height: p.height }).toEqual({ left: q.left, top: q.top, width: q.width, height: q.height });
    expect(p.from.x - q.from.x).toBeCloseTo(61, 0);
    expect(p.from.scale).toBe(q.from.scale);
  });

  it("ne rétrécit jamais en entrant, même quand la carte est plus grande que la place", () => {
    const p = placePreview(landscape(0, 0, 1400), "landscape", { width: 600, height: 400 });
    expect(p?.from.scale).toBe(1);
  });

  it("s'écrit en une transformation CSS composée, sans notation exponentielle", () => {
    expect(previewFromTransform({ x: -12.346, y: 0, scale: 0.5555555 })).toBe("translate(-12.35px, 0px) scale(0.5556)");
  });
});
