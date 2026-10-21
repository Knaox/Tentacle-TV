import { describe, expect, it } from "vitest";
import { nativeStyle, parseTint, sameRect, stackAnchor, toAppKitFrame, toPointRadius, toPoints } from "./geometry";
import type { NativeGlassRegion } from "./protocol";

const region: NativeGlassRegion = {
  id: "barre",
  x: 20,
  y: 700,
  width: 600,
  height: 56,
  radius: 28,
  level: "regular",
  tint: null,
  interactive: false,
  z: 0,
};

describe("toPoints", () => {
  it("multiplie par le zoom de la page, rien d'autre", () => {
    expect(toPoints(region, 1)).toEqual({ x: 20, y: 700, width: 600, height: 56 });
    expect(toPoints(region, 1.25)).toEqual({ x: 25, y: 875, width: 750, height: 70 });
  });

  it("un zoom absurde vaut 1 plutôt qu'un rectangle nul", () => {
    expect(toPoints(region, 0)).toEqual(toPoints(region, 1));
    expect(toPoints(region, Number.NaN)).toEqual(toPoints(region, 1));
  });
});

describe("toPointRadius", () => {
  it("suit le zoom, sans dépasser la demi-hauteur (une capsule reste une capsule)", () => {
    expect(toPointRadius(region, 2)).toBe(56);
    expect(toPointRadius({ ...region, radius: 999 }, 1)).toBe(28);
    expect(toPointRadius({ ...region, radius: -4 }, 1)).toBe(0);
  });
});

describe("toAppKitFrame", () => {
  it("retourne l'axe : la page compte depuis le haut, AppKit depuis le bas", () => {
    // Fenêtre de 800 points : une barre de 56 posée à 700 du haut est à 44 du bas.
    expect(toAppKitFrame({ x: 20, y: 700, width: 600, height: 56 }, 800)).toEqual({ x: 20, y: 44, width: 600, height: 56 });
    expect(toAppKitFrame({ x: 0, y: 0, width: 1280, height: 38 }, 800)).toEqual({ x: 0, y: 762, width: 1280, height: 38 });
  });
});

describe("sameRect", () => {
  it("au centième de point près", () => {
    const a = { x: 1, y: 2, width: 3, height: 4 };
    expect(sameRect(a, { ...a, x: 1.004 })).toBe(true);
    expect(sameRect(a, { ...a, height: 4.5 })).toBe(false);
  });
});

describe("parseTint", () => {
  it("#RRGGBB et #RRGGBBAA, en sRGB de 0 à 1", () => {
    expect(parseTint("#FF0000")).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    const violet = parseTint("#7C3AED80");
    expect(violet?.r).toBeCloseTo(0x7c / 255);
    expect(violet?.a).toBeCloseTo(128 / 255);
  });

  it("null reste null, une forme inconnue aussi", () => {
    expect(parseTint(null)).toBeNull();
    expect(parseTint("#FFF")).toBeNull();
    expect(parseTint("violet")).toBeNull();
  });
});

describe("nativeStyle", () => {
  it("deux styles publics : clear, et regular pour tout le reste", () => {
    expect(nativeStyle("clear")).toBe(1);
    expect(nativeStyle("regular")).toBe(0);
    expect(nativeStyle("tinted")).toBe(0);
    expect(nativeStyle("prominent")).toBe(0);
  });
});

describe("stackAnchor", () => {
  const items = [
    { key: "fond", z: 0, seq: 1 },
    { key: "barre", z: 1, seq: 2 },
    { key: "toast", z: 5, seq: 3 },
    { key: "pastille", z: 1, seq: 4 },
  ];

  it("rend l'élément qui doit être juste au-dessus", () => {
    expect(stackAnchor(items, "fond")).toBe("barre");
    // À profondeur égale, le dernier venu passe au-dessus — comme deux frères en CSS.
    expect(stackAnchor(items, "barre")).toBe("pastille");
    expect(stackAnchor(items, "pastille")).toBe("toast");
  });

  it("null : tout en haut, ou inconnu", () => {
    expect(stackAnchor(items, "toast")).toBeNull();
    expect(stackAnchor(items, "absent")).toBeNull();
  });
});
