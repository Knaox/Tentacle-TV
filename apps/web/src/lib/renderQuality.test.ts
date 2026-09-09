import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mpvRenderOptions, renderQualityChoice, setRenderQuality } from "./renderQuality";

/** `localStorage` est absent de l'environnement de test — voir hardwareDecoding. */
const store = new Map<string, string>();
beforeAll(() =>
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  }),
);
afterEach(() => setRenderQuality("auto"));

describe("renderQuality", () => {
  it("« Automatique » ne pose RIEN — mpv garde ses défauts", () => {
    // Poser explicitement les valeurs mesurées les figerait à la version
    // d'aujourd'hui ; on veut suivre mpv quand il changera d'avis.
    setRenderQuality("auto");
    expect(mpvRenderOptions()).toEqual({});
  });

  it("« Économe » allège les sept passes par image", () => {
    setRenderQuality("eco");
    expect(mpvRenderOptions()).toEqual({
      scale: "bilinear",
      dscale: "bilinear",
      "correct-downscaling": "no",
      "linear-downscaling": "no",
      "sigmoid-upscaling": "no",
      dither: "no",
      "hdr-compute-peak": "no",
    });
  });

  it("le choix survit à l'aller-retour par le stockage", () => {
    setRenderQuality("eco");
    expect(renderQualityChoice()).toBe("eco");
    setRenderQuality("auto");
    expect(renderQualityChoice()).toBe("auto");
  });

  it("retombe sur « Automatique » quand le stockage est indisponible", () => {
    // Fenêtre privée, stockage bloqué : le lecteur doit rendre l'image
    // habituelle, jamais une image dégradée par accident.
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("stockage bloqué");
      },
      setItem: () => {
        throw new Error("stockage bloqué");
      },
    });
    expect(renderQualityChoice()).toBe("auto");
    expect(mpvRenderOptions()).toEqual({});
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
  });
});
