/**
 * L'invariant tenu ici : `geometry` n'existe QUE pour le montage fenêtré
 * libre (colle KDE), en taille seule et en pixels PHYSIQUES (mpv la lit
 * ainsi — mesuré : les bounds logiques nus donnaient une fenêtre moitié
 * plus petite sur l'écran ×2), jamais depuis des bornes ou une échelle
 * dégénérées — partout ailleurs l'option est absente.
 */

import { describe, expect, it } from "vitest";
import { initialGeometryOption } from "./initialGeometry";

describe("initialGeometryOption", () => {
  it("colle KDE : la taille de l'hôte en pixels physiques, sans position", () => {
    expect(initialGeometryOption("wayland", "libre", { width: 1280, height: 800 }, 1))
      .toEqual({ geometry: "1280x800" });
  });

  it("écran ×2 : l'échelle multiplie — mpv lit du physique", () => {
    expect(initialGeometryOption("wayland", "libre", { width: 1152, height: 828 }, 2))
      .toEqual({ geometry: "2304x1656" });
  });

  it("échelle fractionnaire : arrondi au pixel", () => {
    expect(initialGeometryOption("wayland", "libre", { width: 1000, height: 700 }, 1.25))
      .toEqual({ geometry: "1250x875" });
  });

  it("échelle folle : repli à 1, jamais une fenêtre géante", () => {
    expect(initialGeometryOption("wayland", "libre", { width: 1280, height: 800 }, 40))
      .toEqual({ geometry: "1280x800" });
    expect(initialGeometryOption("wayland", "libre", { width: 1280, height: 800 }, Number.NaN))
      .toEqual({ geometry: "1280x800" });
    expect(initialGeometryOption("wayland", "libre", { width: 1280, height: 800 }, 0))
      .toEqual({ geometry: "1280x800" });
  });

  it("plein écran imposé : aucune option", () => {
    expect(initialGeometryOption("wayland", "plein-ecran", { width: 1280, height: 800 }, 1))
      .toEqual({});
  });

  it("X11 : aucune option — le calage y est fait par la surface", () => {
    expect(initialGeometryOption("x11", null, { width: 1280, height: 800 }, 1)).toEqual({});
  });

  it("montage inconnu : aucune option", () => {
    expect(initialGeometryOption(null, null, { width: 1280, height: 800 }, 1)).toEqual({});
  });

  it("bornes dégénérées : aucune option plutôt qu'une geometry absurde", () => {
    expect(initialGeometryOption("wayland", "libre", { width: 0, height: 0 }, 1)).toEqual({});
    expect(initialGeometryOption("wayland", "libre", { width: Number.NaN, height: 800 }, 1))
      .toEqual({});
  });
});
