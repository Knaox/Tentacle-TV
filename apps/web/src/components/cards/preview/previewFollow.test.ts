import { describe, expect, it } from "vitest";
import { followOutOfPlace, horizontalWheelDelta, inDocument, type FollowFrame } from "./previewFollow";
import type { PreviewPlacement } from "./previewPlacement";

/**
 * L'accroche pendant le défilement : la place portée dans le document, ce
 * qui fait fermer la mini-carte plutôt que de sortir de sa place, et la
 * molette horizontale qu'on prend en main. Fenêtre de 1440 × 900, barre du
 * haut jusqu'à 68 px, mini-carte de 331 × 350.
 */
const frame = (over: Partial<FollowFrame> = {}): FollowFrame => ({
  box: { left: 600, top: 300, width: 331, height: 350 },
  card: { left: 660, right: 870 },
  view: { left: 0, right: 1440 },
  viewport: { width: 1440, height: 900, safeTop: 68 },
  step: 0,
  ...over,
});

describe("inDocument — la mini-carte défile avec la page", () => {
  it("porte la place de la fenêtre dans le document, sans toucher au départ ni à la taille", () => {
    const placement: PreviewPlacement = { left: 600, top: 300, width: 331, height: 350, videoHeight: 186, from: { x: 0, y: 0, scale: 0.6 } };
    expect(inDocument(placement, { x: 0, y: 1200 })).toEqual({ ...placement, top: 1500 });
  });
});

describe("followOutOfPlace — jamais sous la barre, jamais hors de la fenêtre", () => {
  it("reste tant qu'elle est à sa place", () => {
    expect(followOutOfPlace(frame())).toBe(false);
    expect(followOutOfPlace(frame({ box: { left: 16, top: 84, width: 331, height: 350 } }))).toBe(false);
  });

  it("se ferme UNE IMAGE avant de passer sous la barre : la page va plus vite que l'écouteur", () => {
    expect(followOutOfPlace(frame({ box: { left: 600, top: 100, width: 331, height: 350 }, step: 20 }))).toBe(false);
    expect(followOutOfPlace(frame({ box: { left: 600, top: 100, width: 331, height: 350 }, step: 40 }))).toBe(true);
    expect(followOutOfPlace(frame({ box: { left: 600, top: 60, width: 331, height: 350 } }))).toBe(true);
  });

  it("de même par le bas quand la page remonte", () => {
    expect(followOutOfPlace(frame({ box: { left: 600, top: 520, width: 331, height: 350 }, step: -20 }))).toBe(false);
    expect(followOutOfPlace(frame({ box: { left: 600, top: 520, width: 331, height: 350 }, step: -40 }))).toBe(true);
    // Vers le bas, le bas n'est pas menacé : seul le sens du défilement compte.
    expect(followOutOfPlace(frame({ box: { left: 600, top: 520, width: 331, height: 350 }, step: 40 }))).toBe(false);
  });

  it("se ferme hors des bords de la fenêtre, ou quand sa carte quitte la rangée visible", () => {
    expect(followOutOfPlace(frame({ box: { left: -2, top: 300, width: 331, height: 350 } }))).toBe(true);
    expect(followOutOfPlace(frame({ box: { left: 1110, top: 300, width: 331, height: 350 } }))).toBe(true);
    expect(followOutOfPlace(frame({ view: { left: 200, right: 800 } }))).toBe(false);
    expect(followOutOfPlace(frame({ view: { left: 200, right: 800 }, card: { left: 700, right: 910 } }))).toBe(true);
    expect(followOutOfPlace(frame({ view: null, card: { left: 5000, right: 5200 } }))).toBe(false);
  });
});

describe("horizontalWheelDelta — la molette qu'on prend en main", () => {
  const wheel = (deltaX: number, deltaY: number, over: Partial<{ deltaMode: number; shiftKey: boolean }> = {}) => ({
    deltaX, deltaY, deltaMode: 0, shiftKey: false, ...over,
  });

  it("rend le pas horizontal d'un geste d'abord horizontal (pavé tactile)", () => {
    expect(horizontalWheelDelta(wheel(30, 4), 1440)).toBe(30);
    expect(horizontalWheelDelta(wheel(-12, 0), 1440)).toBe(-12);
  });

  it("laisse au navigateur un geste d'abord vertical : la page défile normalement", () => {
    expect(horizontalWheelDelta(wheel(4, 30), 1440)).toBeNull();
    expect(horizontalWheelDelta(wheel(0, 100), 1440)).toBeNull();
    expect(horizontalWheelDelta(wheel(0, 0), 1440)).toBeNull();
  });

  it("Maj + molette verticale vaut un pas horizontal (Windows, Linux)", () => {
    expect(horizontalWheelDelta(wheel(0, 100, { shiftKey: true }), 1440)).toBe(100);
  });

  it("convertit les lignes et les pages en pixels", () => {
    expect(horizontalWheelDelta(wheel(3, 0, { deltaMode: 1 }), 1440)).toBe(120);
    expect(horizontalWheelDelta(wheel(1, 0, { deltaMode: 2 }), 1000)).toBe(900);
  });
});
