import { describe, expect, it } from "vitest";
import { RENDER_PROFILES, renderProfileOf } from "./renderProfile";

describe("le profil de rendu", () => {
  it("garde à l'Apple TV son rendu de référence : ombres du système, verre natif, rien d'Android", () => {
    expect(renderProfileOf("tvos")).toEqual({
      motion: true,
      nativeGlass: true,
      shadows: "layer",
      haloDrawScale: 0.25,
      halos: "svg",
      lights: "svg",
      svgBlur: "points",
      cardArtwork: { landscapeWidth: 640, posterHeight: 480 },
      stagedRows: false,
      imageScale: 2,
      spinner: "system",
      cullOffscreen: false,
    });
  });

  it("donne à Android TV le même mouvement, des ombres en masque et jamais le verre natif", () => {
    const android = renderProfileOf("androidtv");
    expect(android.motion).toBe(true);
    expect(android.shadows).toBe("mask");
    expect(android.nativeGlass).toBe(false);
    expect(android.halos).toBe("mask");
    expect(android.lights).toBe("shader");
    expect(android.haloDrawScale).toBe(RENDER_PROFILES.tvos.haloDrawScale);
    expect(android.stagedRows).toBe(true);
    expect(android.imageScale).toBe(1);
    expect(android.spinner).toBe("drawn");
    expect(android.cullOffscreen).toBe(true);
  });

  it("demande sur Android TV les images des cartes à leur plus grande taille d'affichage, focus compris", () => {
    const { cardArtwork } = renderProfileOf("androidtv");
    const focused = (points: number) => Math.ceil(points * 1.08);
    // La plus grande vignette (380 points), la plus grande affiche (grille de 6 : 366).
    expect(cardArtwork.landscapeWidth).toBeGreaterThanOrEqual(focused(380));
    expect(cardArtwork.posterHeight).toBeGreaterThanOrEqual(focused(366));
    // Et pas un pixel de plus que le pas suivant.
    expect(cardArtwork.landscapeWidth).toBeLessThan(focused(380) + 8);
    expect(cardArtwork.posterHeight).toBeLessThan(focused(366) + 8);
  });

  it("rend le profil le plus sobre à une plateforme inconnue", () => {
    expect(renderProfileOf("web")).toBe(RENDER_PROFILES.androidtv);
  });
});
