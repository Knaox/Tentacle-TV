import { describe, expect, it } from "vitest";
import { dropShadowOf, shadowExtent, shadowMaskGeometry } from "./dropShadow";

describe("l'ombre lue dans les styles iOS", () => {
  it("reprend couleur, opacité, flou et décalage tels qu'écrits", () => {
    expect(
      dropShadowOf({ shadowColor: "#000", shadowOpacity: 0.65, shadowRadius: 30, shadowOffset: { width: 0, height: 28 } }),
    ).toEqual({ color: "#000", opacity: 0.65, blur: 30, offsetX: 0, offsetY: 28 });
  });

  it("n'en dessine aucune sans opacité — le défaut de CALayer", () => {
    expect(dropShadowOf({ shadowColor: "#f0f", shadowRadius: 12 })).toBeNull();
    expect(dropShadowOf({ shadowOpacity: 0 })).toBeNull();
    expect(dropShadowOf(null)).toBeNull();
  });

  it("prend les défauts de CALayer pour ce qui est tu : noir, rayon 3, (0, −3)", () => {
    expect(dropShadowOf({ shadowOpacity: 0.5 })).toEqual({ color: "#000", opacity: 0.5, blur: 3, offsetX: 0, offsetY: -3 });
  });

  it("un décalage écrit en partie vaut zéro pour l'autre axe", () => {
    expect(dropShadowOf({ shadowOpacity: 1, shadowOffset: { width: 4 } })?.offsetY).toBe(0);
  });

  it("borne l'opacité et la multiplie par la couverture de ce qui la projette", () => {
    expect(dropShadowOf({ shadowOpacity: 3 })?.opacity).toBe(1);
    expect(dropShadowOf({ shadowOpacity: 0.5 }, 0.5)?.opacity).toBe(0.25);
    expect(dropShadowOf({ shadowOpacity: 0.5 }, 0)).toBeNull();
  });
});

describe("la géométrie du masque", () => {
  it("garde trois écarts-types de marge", () => {
    expect(shadowMaskGeometry(30).margin).toBe(90);
    expect(shadowMaskGeometry(0).margin).toBe(0);
  });

  it("calcule un grand flou en petit, sans descendre sous quatre pixels d'écart-type", () => {
    expect(shadowMaskGeometry(4).scale).toBe(1);
    expect(shadowMaskGeometry(30).scale * 30).toBeCloseTo(4);
    expect(shadowMaskGeometry(200).scale).toBe(0.125);
  });
});

describe("l'étendue d'une ombre", () => {
  it("couvre la marge du flou et le plus grand décalage", () => {
    expect(shadowExtent({ blur: 30, offsetX: 0, offsetY: 28 })).toBe(118);
    expect(shadowExtent({ blur: 4, offsetX: -3, offsetY: 2 })).toBe(15);
  });
});
