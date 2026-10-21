import { describe, expect, it } from "vitest";
import {
  lensBezelToken,
  lensFilterId,
  regionSpecOf,
  resolveSurfaceRender,
  surfaceAttributes,
  surfaceClassName,
} from "./surfaceModel";

/**
 * Le modèle pur d'une surface : le rendu selon le mode et ce qu'il y a
 * derrière, les classes, les attributs, le biseau.
 */

describe("resolveSurfaceRender", () => {
  it("hors du mode natif : toujours le rendu d'avant", () => {
    for (const mode of ["refraction", "off"] as const) {
      expect(resolveSurfaceRender(mode, "page")).toBe("fallback");
      expect(resolveSurfaceRender(mode, "window")).toBe("fallback");
    }
  });

  it("en natif : la lentille sur la page, le verre de macOS sur la fenêtre", () => {
    expect(resolveSurfaceRender("native", "page")).toBe("lens");
    expect(resolveSurfaceRender("native", "window")).toBe("native");
  });
});

describe("surfaceClassName", () => {
  it("le rendu d'avant : mise en page + rendu d'avant, rien d'autre", () => {
    expect(surfaceClassName("fallback", "flex", "bg-black/60")).toBe("flex bg-black/60");
    expect(surfaceClassName("fallback", undefined, undefined)).toBe("");
  });

  it("le verre : la surface + la mise en page, jamais le rendu d'avant", () => {
    expect(surfaceClassName("lens", "flex", "bg-black/60")).toBe("lg-surface flex");
    expect(surfaceClassName("native", undefined, "bg-black/60")).toBe("lg-surface");
  });
});

describe("surfaceAttributes", () => {
  it("rien en rendu d'avant", () => {
    expect(surfaceAttributes({ level: "tinted", interactive: true }, "fallback")).toEqual({});
  });

  it("les défauts : regular, rounded, md", () => {
    expect(surfaceAttributes({}, "lens")).toEqual({
      "data-lg-render": "lens",
      "data-lg-level": "regular",
      "data-lg-shape": "rounded",
      "data-lg-radius": "md",
    });
  });

  it("une capsule n'a pas de rayon à choisir", () => {
    expect(surfaceAttributes({ shape: "capsule", tint: "accent", interactive: true }, "native")).toEqual({
      "data-lg-render": "native",
      "data-lg-level": "regular",
      "data-lg-shape": "capsule",
      "data-lg-tint": "accent",
      "data-lg-interactive": "",
    });
  });
});

describe("regionSpecOf", () => {
  it("les défauts d'une région native", () => {
    expect(regionSpecOf({})).toEqual({
      level: "regular",
      shape: "rounded",
      tint: "brand",
      interactive: false,
      z: 0,
    });
  });
});

describe("lens", () => {
  it("le biseau grandit avec la plus petite dimension", () => {
    expect(lensBezelToken(300, 28)).toBe("--lg-bezel-sm");
    expect(lensBezelToken(300, 44)).toBe("--lg-bezel-md");
    expect(lensBezelToken(600, 400)).toBe("--lg-bezel-lg");
  });

  it("un identifiant de filtre utilisable dans url(#…)", () => {
    expect(lensFilterId("«r1»")).toBe("lg-lens-r1");
    expect(lensFilterId(":r2a:")).toBe("lg-lens-r2a");
  });
});
