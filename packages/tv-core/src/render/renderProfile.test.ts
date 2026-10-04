import { describe, expect, it } from "vitest";
import { RENDER_PROFILES, renderProfileOf } from "./renderProfile";

describe("le profil de rendu", () => {
  it("garde à l'Apple TV son rendu de référence : ombres du système, verre natif, rien d'Android", () => {
    expect(renderProfileOf("tvos")).toEqual({
      motion: true,
      nativeGlass: true,
      shadows: "layer",
      haloDrawScale: 0.25,
      svgBlur: "points",
      animatedLayerTexture: false,
      muteReleaseLogs: false,
    });
  });

  it("donne à Android TV le même mouvement, des ombres en masque et jamais le verre natif", () => {
    const android = renderProfileOf("androidtv");
    expect(android.motion).toBe(true);
    expect(android.shadows).toBe("mask");
    expect(android.nativeGlass).toBe(false);
    expect(android.haloDrawScale).toBe(RENDER_PROFILES.tvos.haloDrawScale);
  });

  it("rend le profil le plus sobre à une plateforme inconnue", () => {
    expect(renderProfileOf("web")).toBe(RENDER_PROFILES.androidtv);
  });
});
