import { describe, expect, it } from "vitest";
import { LANGUAGE_CODE_GROUPS } from "./langSubtags";
import { LANGUAGE_NAMES, languageDisplayName } from "./langNames";

describe("languageDisplayName", () => {
  it("couvre chaque langue de la table des codes", () => {
    for (const group of LANGUAGE_CODE_GROUPS) {
      const primary = group[0] ?? "";
      expect(LANGUAGE_NAMES[primary], primary).toBeDefined();
    }
  });

  it("ramène les codes à deux et trois lettres au même nom", () => {
    expect(languageDisplayName("fr", "fr")).toBe("Français");
    expect(languageDisplayName("fre", "fr")).toBe("Français");
    expect(languageDisplayName("fra", "fr")).toBe("Français");
    expect(languageDisplayName("jpn", "en")).toBe("Japanese");
    expect(languageDisplayName("scc", "fr")).toBe("Serbe");
  });

  it("connaît les régions courantes, avec tiret ou souligné", () => {
    expect(languageDisplayName("fr-BE", "fr")).toBe("Français (Belgique)");
    expect(languageDisplayName("fr_be", "fr")).toBe("Français (Belgique)");
    expect(languageDisplayName("pt-BR", "fr")).toBe("Portugais (Brésil)");
    expect(languageDisplayName("zh-Hant", "en")).toBe("Chinese (Traditional)");
    expect(languageDisplayName("es-419", "en")).toBe("Spanish (Latin America)");
  });

  it("retombe sur la langue seule pour une région inconnue", () => {
    expect(languageDisplayName("fr-LU", "fr")).toBe("Français");
    expect(languageDisplayName("de-LI", "en")).toBe("German");
  });

  it("suit la langue d'interface, anglais par défaut", () => {
    expect(languageDisplayName("de", "fr-FR")).toBe("Allemand");
    expect(languageDisplayName("de", "en-US")).toBe("German");
    expect(languageDisplayName("de", "es")).toBe("German");
  });

  it("rend null pour un code inconnu ou vide", () => {
    expect(languageDisplayName("zzz", "fr")).toBeNull();
    expect(languageDisplayName("", "fr")).toBeNull();
    expect(languageDisplayName(undefined, "fr")).toBeNull();
  });
});
