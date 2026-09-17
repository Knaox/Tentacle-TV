/**
 * La taille de naissance de la fenêtre mpv : des pixels PHYSIQUES, à l'échelle
 * que la page mesure — l'écran à l'origine mentait (×1,25 pour un écran ×2,
 * 17.09.2026), et sans l'échelle mpv naissait moitié trop petit (28.08).
 */

import { describe, expect, it } from "vitest";
import { initialGeometryOption } from "./initialGeometry";

const measure = (width: number, height: number, density: number) => ({ width, height, density });

describe("la taille de naissance de la fenêtre mpv", () => {
  it("vaut la page en pixels physiques, sur le montage collé seulement", () => {
    expect(initialGeometryOption("wayland", "libre", measure(1152, 800, 2))).toEqual({ geometry: "2304x1600" });
    expect(initialGeometryOption("wayland", "plein-ecran", measure(1152, 800, 2))).toEqual({});
    expect(initialGeometryOption("x11", null, measure(1152, 800, 2))).toEqual({});
    expect(initialGeometryOption(null, null, measure(1152, 800, 2))).toEqual({});
  });

  it("suit l'échelle de la PAGE, fractionnaire comprise", () => {
    expect(initialGeometryOption("wayland", "libre", measure(1152, 800, 1.25))).toEqual({ geometry: "1440x1000" });
  });

  it("une échelle folle retombe à 1 ; une mesure absente ou dégénérée ne produit rien", () => {
    expect(initialGeometryOption("wayland", "libre", measure(1000, 600, 9))).toEqual({ geometry: "1000x600" });
    expect(initialGeometryOption("wayland", "libre", null)).toEqual({});
    expect(initialGeometryOption("wayland", "libre", measure(40, 800, 2))).toEqual({});
    expect(initialGeometryOption("wayland", "libre", measure(Number.NaN, 800, 2))).toEqual({});
  });
});
