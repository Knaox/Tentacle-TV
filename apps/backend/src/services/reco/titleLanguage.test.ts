import { afterEach, describe, expect, it } from "vitest";
import { languageTag, setTitleLanguage, titleLanguageParams } from "./titleLanguage";

describe("langue des titres", () => {
  afterEach(() => setTitleLanguage(undefined));

  it("la langue des métadonnées de Jellyfin devient l'étiquette TMDB", () => {
    expect(languageTag("fr", "FR")).toBe("fr-FR");
    expect(languageTag("pt-BR", "BR")).toBe("pt-BR");
    expect(languageTag("en", "")).toBe("en");
    expect(languageTag("", "FR")).toBeNull();
  });

  it("inconnue : aucune langue imposée à TMDB", () => {
    setTitleLanguage(null);
    expect(titleLanguageParams()).toEqual({});
    setTitleLanguage("fr-FR");
    expect(titleLanguageParams()).toEqual({ language: "fr-FR" });
  });
});
