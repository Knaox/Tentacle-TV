import { describe, expect, it } from "vitest";
import { isTabletLayout, resolveOctaveLayout } from "./octaveLayout";

describe("resolveOctaveLayout", () => {
  it("téléphone : le téléphone d'Octave, quelle que soit l'orientation", () => {
    expect(resolveOctaveLayout({ formFactor: "phone", landscape: false, narrowWindow: true })).toBe("phone");
    // Un téléphone couché dépasse 768 px : il reste un téléphone (avant : la coquille du bureau).
    expect(resolveOctaveLayout({ formFactor: "phone", landscape: true, narrowWindow: false })).toBe("phone");
  });

  it("tablette : le rail en portrait, la barre latérale en paysage", () => {
    expect(resolveOctaveLayout({ formFactor: "tablet", landscape: false, narrowWindow: true })).toBe("tablet-rail");
    expect(resolveOctaveLayout({ formFactor: "tablet", landscape: true, narrowWindow: false })).toBe("tablet-wide");
  });

  it("bureau : inchangé — large = bureau, fenêtre étroite (Electron) = téléphone d'avant", () => {
    expect(resolveOctaveLayout({ formFactor: "desktop", landscape: true, narrowWindow: false })).toBe("desktop");
    expect(resolveOctaveLayout({ formFactor: "desktop", landscape: true, narrowWindow: true })).toBe("phone");
  });

  it("isTabletLayout", () => {
    expect(isTabletLayout("tablet-rail")).toBe(true);
    expect(isTabletLayout("tablet-wide")).toBe(true);
    expect(isTabletLayout("phone")).toBe(false);
    expect(isTabletLayout("desktop")).toBe(false);
  });
});
