/**
 * L'invariant tenu ici : `geometry` n'existe QUE pour le montage fenêtré
 * libre (colle KDE), en taille seule, et jamais depuis des bornes dégénérées —
 * partout ailleurs l'option est absente et mpv garde son comportement.
 */

import { describe, expect, it } from "vitest";
import { initialGeometryOption } from "./initialGeometry";

describe("initialGeometryOption", () => {
  it("colle KDE : la taille de l'hôte, sans position", () => {
    expect(initialGeometryOption("wayland", "libre", { width: 1280, height: 800 }))
      .toEqual({ geometry: "1280x800" });
  });

  it("plein écran imposé : aucune option", () => {
    expect(initialGeometryOption("wayland", "plein-ecran", { width: 1280, height: 800 }))
      .toEqual({});
  });

  it("X11 : aucune option — le calage y est fait par la surface", () => {
    expect(initialGeometryOption("x11", null, { width: 1280, height: 800 })).toEqual({});
  });

  it("montage inconnu : aucune option", () => {
    expect(initialGeometryOption(null, null, { width: 1280, height: 800 })).toEqual({});
  });

  it("bornes dégénérées : aucune option plutôt qu'une geometry absurde", () => {
    expect(initialGeometryOption("wayland", "libre", { width: 0, height: 0 })).toEqual({});
    expect(initialGeometryOption("wayland", "libre", { width: Number.NaN, height: 800 })).toEqual({});
    expect(initialGeometryOption("wayland", "libre", { width: 1280.7, height: 800.2 }))
      .toEqual({ geometry: "1280x800" });
  });
});
