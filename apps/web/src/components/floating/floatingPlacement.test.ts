import { describe, expect, it } from "vitest";
import { placeFloating } from "./floatingPlacement";

const viewport = { width: 800, height: 600 };
const button = { top: 14, bottom: 54, left: 700, right: 740 };

describe("placement des panneaux flottants", () => {
  it("sous le bouton, aligné à droite, quand il y tient", () => {
    const p = placeFloating({ anchor: button, size: { width: 300, height: 200 }, viewport });
    expect(p).toMatchObject({ side: "bottom", top: 62, left: 440, maxHeight: 600 - 8 - 62 });
  });

  it("jamais hors du bord gauche en fenêtre étroite : décalé, puis borné", () => {
    const narrow = { width: 400, height: 700 };
    const bell = { top: 14, bottom: 54, left: 300, right: 344 };
    const p = placeFloating({ anchor: bell, size: { width: 384, height: 300 }, viewport: narrow });
    expect(p.left).toBe(8);
    expect(p.left + Math.min(384, p.maxWidth)).toBeLessThanOrEqual(400 - 8);
  });

  it("trop haut pour la fenêtre : borné à la place restante, il défile dedans", () => {
    const p = placeFloating({ anchor: button, size: { width: 260, height: 900 }, viewport });
    expect(p.side).toBe("bottom");
    expect(p.top + p.maxHeight).toBe(600 - 8);
  });

  it("retourné au-dessus quand la place manque en dessous (clic droit en bas de fenêtre)", () => {
    const point = { top: 560, bottom: 560, left: 780, right: 780 };
    const p = placeFloating({ anchor: point, size: { width: 240, height: 300 }, viewport, align: "start", gap: 0 });
    expect(p.side).toBe("top");
    expect(p.top).toBe(260);
    expect(p.left).toBe(800 - 8 - 240);
  });

  it("ne se retourne jamais vers un côté où il tiendrait moins", () => {
    const mid = { top: 280, bottom: 300, left: 100, right: 140 };
    const p = placeFloating({ anchor: mid, size: { width: 200, height: 1000 }, viewport, side: "top" });
    expect(p.side).toBe("bottom");
    expect(p.maxHeight).toBe(600 - 8 - 308);
  });

  it("à côté de l'ancre (side right), recalé verticalement", () => {
    const rail = { top: 500, bottom: 540, left: 0, right: 64 };
    const p = placeFloating({ anchor: rail, size: { width: 384, height: 400 }, viewport, side: "right", align: "end" });
    expect(p).toMatchObject({ side: "right", left: 72 });
    expect(p.top + 400).toBeLessThanOrEqual(600 - 8);
  });
});
