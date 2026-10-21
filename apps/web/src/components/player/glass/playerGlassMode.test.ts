import { describe, expect, it } from "vitest";
import { decidePlayerGlassMode, isGlassLayout } from "./playerGlassMode";

const base = { enabled: true, nativeAvailable: true, videoUnderWindow: true, devPreview: false };

describe("decidePlayerGlassMode", () => {
  it("pose le verre natif quand les trois conditions tiennent", () => {
    expect(decidePlayerGlassMode(base)).toBe("native");
  });

  it("réglage coupé : rendu d'avant, même avec l'aperçu demandé", () => {
    expect(decidePlayerGlassMode({ ...base, enabled: false })).toBe("legacy");
    expect(decidePlayerGlassMode({ ...base, enabled: false, devPreview: true })).toBe("legacy");
  });

  it("montage Intel (vidéo DANS la fenêtre) : rendu d'avant", () => {
    expect(decidePlayerGlassMode({ ...base, videoUnderWindow: false })).toBe("legacy");
  });

  it("OS sans verre natif : rendu d'avant", () => {
    expect(decidePlayerGlassMode({ ...base, nativeAvailable: false })).toBe("legacy");
  });

  it("l'aperçu de développement ne sert que là où le natif manque", () => {
    expect(decidePlayerGlassMode({ ...base, nativeAvailable: false, devPreview: true })).toBe("preview");
    expect(decidePlayerGlassMode({ ...base, devPreview: true })).toBe("native");
  });

  it("isGlassLayout : natif et aperçu partagent la mise en page", () => {
    expect(isGlassLayout("native")).toBe(true);
    expect(isGlassLayout("preview")).toBe(true);
    expect(isGlassLayout("legacy")).toBe(false);
  });
});
