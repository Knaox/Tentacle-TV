import { describe, expect, it } from "vitest";
import { extensionSectionHref, extensionSectionId, parseExtensionSectionId } from "./extensionSection";

describe("identité d'une section d'extension", () => {
  it("fait l'aller-retour identifiant → parties", () => {
    const id = extensionSectionId("seer", "/requests");
    expect(id).toBe("seer:/requests");
    expect(parseExtensionSectionId(id)).toEqual({ pluginId: "seer", path: "/requests" });
  });

  it("coupe sur le premier deux-points : le chemin peut en contenir", () => {
    expect(parseExtensionSectionId("seer:/media/movie:603")).toEqual({
      pluginId: "seer",
      path: "/media/movie:603",
    });
  });

  it("refuse un identifiant sans plugin, sans chemin ou sans séparateur", () => {
    expect(parseExtensionSectionId(":/requests")).toBeNull();
    expect(parseExtensionSectionId("seer:")).toBeNull();
    expect(parseExtensionSectionId("seer")).toBeNull();
    expect(parseExtensionSectionId("")).toBeNull();
  });

  it("encode le lien profond pour la query string", () => {
    expect(extensionSectionHref("seer", "/requests")).toBe("/extensions?section=seer%3A%2Frequests");
  });
});
