import { describe, expect, it } from "vitest";
import {
  cssColorToHex,
  nativeTintToken,
  regionFromBox,
  sameRegion,
  type RegionSpec,
} from "./regionGeometry";

/**
 * Ce que la page dit à la coquille d'une région : la boîte dans le viewport,
 * le rayon (à l'échelle d'une transformation), la teinte `#RRGGBBAA` — et
 * rien pour une région qui ne se voit pas.
 */

const spec: RegionSpec = {
  level: "regular",
  shape: "rounded",
  tint: "brand",
  interactive: false,
  z: 0,
  group: null,
  spacing: null,
  transition: null,
};
const viewport = { width: 1280, height: 800 };
const style = { radius: 16, tint: null };

describe("cssColorToHex", () => {
  it("rgba à virgules, celui que rendent nos jetons", () => {
    expect(cssColorToHex("rgba(139, 92, 246, 0.38)")).toBe("#8B5CF661");
  });

  it("rgb opaque, syntaxe à espaces, pourcentage", () => {
    expect(cssColorToHex("rgb(255, 0, 128)")).toBe("#FF0080FF");
    expect(cssColorToHex("rgb(139 92 246 / 50%)")).toBe("#8B5CF680");
  });

  it("hexadécimal court et long", () => {
    expect(cssColorToHex(" #fff ")).toBe("#FFFFFFFF");
    expect(cssColorToHex("#8b5cf6")).toBe("#8B5CF6FF");
    expect(cssColorToHex("#8b5cf680")).toBe("#8B5CF680");
  });

  it("transparent, alpha nul ou illisible : aucune teinte", () => {
    expect(cssColorToHex("transparent")).toBeNull();
    expect(cssColorToHex("")).toBeNull();
    expect(cssColorToHex("rgba(0, 0, 0, 0)")).toBeNull();
    expect(cssColorToHex("#00000000")).toBeNull();
    expect(cssColorToHex("var(--x)")).toBeNull();
  });
});

describe("nativeTintToken", () => {
  it("par niveau ; le rose seulement pour les niveaux teintés", () => {
    expect(nativeTintToken({ level: "regular", tint: "brand" })).toBe("--lg-native-tint-regular");
    expect(nativeTintToken({ level: "regular", tint: "accent" })).toBe("--lg-native-tint-regular");
    expect(nativeTintToken({ level: "tinted", tint: "accent" })).toBe("--lg-native-tint-tinted-accent");
    expect(nativeTintToken({ level: "prominent", tint: "brand" })).toBe("--lg-native-tint-prominent");
  });
});

describe("regionFromBox", () => {
  const box = { x: 100.004, y: 40, width: 300, height: 44, layoutWidth: 300 };

  it("la boîte au centième, le rayon des feuilles, la description", () => {
    expect(regionFromBox("a", box, spec, style, viewport)).toEqual({
      id: "a",
      x: 100,
      y: 40,
      width: 300,
      height: 44,
      radius: 16,
      level: "regular",
      tint: null,
      interactive: false,
      z: 0,
    });
  });

  it("capsule et cercle : la demi-hauteur ; rect : zéro ; jamais plus que la demi-hauteur", () => {
    expect(regionFromBox("a", box, { ...spec, shape: "capsule" }, style, viewport)?.radius).toBe(22);
    expect(regionFromBox("a", box, { ...spec, shape: "rect" }, style, viewport)?.radius).toBe(0);
    expect(regionFromBox("a", box, spec, { radius: 9999, tint: null }, viewport)?.radius).toBe(22);
  });

  it("agrandie par une transformation, les coins suivent l'échelle", () => {
    const scaled = { x: 0, y: 0, width: 330, height: 48.4, layoutWidth: 300 };
    expect(regionFromBox("a", scaled, spec, style, viewport)?.radius).toBeCloseTo(17.6, 2);
  });

  it("groupe, distance de fusion, animation native : présents seulement s'ils sont demandés", () => {
    const grouped = regionFromBox(
      "a",
      box,
      { ...spec, group: "lecteur-barre", spacing: 12, transition: 240 },
      style,
      viewport,
    );
    expect(grouped).toMatchObject({ group: "lecteur-barre", spacing: 12, transition: 240 });
    const alone = regionFromBox("a", box, spec, style, viewport);
    expect(alone).not.toHaveProperty("group");
    expect(alone).not.toHaveProperty("spacing");
    expect(alone).not.toHaveProperty("transition");
  });

  it("vide ou hors de l'écran : rien à envoyer", () => {
    expect(regionFromBox("a", { ...box, width: 0 }, spec, style, viewport)).toBeNull();
    expect(regionFromBox("a", { ...box, y: -44 }, spec, style, viewport)).toBeNull();
    expect(regionFromBox("a", { ...box, x: 1280 }, spec, style, viewport)).toBeNull();
    // À cheval sur le bord : envoyée, la coquille découpe.
    expect(regionFromBox("a", { ...box, y: -20 }, spec, style, viewport)).not.toBeNull();
  });
});

describe("sameRegion", () => {
  it("ne voit que ce qui compte pour la coquille", () => {
    const a = regionFromBox("a", { x: 0, y: 0, width: 10, height: 10, layoutWidth: 10 }, spec, style, viewport);
    const b = regionFromBox("a", { x: 0, y: 0.001, width: 10, height: 10, layoutWidth: 10 }, spec, style, viewport);
    const c = regionFromBox("a", { x: 0, y: 1, width: 10, height: 10, layoutWidth: 10 }, spec, style, viewport);
    if (a === null || b === null || c === null) throw new Error("régions attendues");
    expect(sameRegion(a, b)).toBe(true);
    expect(sameRegion(a, c)).toBe(false);
    expect(sameRegion(a, { ...a, tint: "#FFFFFFFF" })).toBe(false);
    expect(sameRegion(a, { ...a, group: "barre" })).toBe(false);
  });
});
