import { describe, expect, it } from "vitest";
import { summarizeLibraryPref } from "./libraryPrefOptions";

const t = (key: string) => key;

describe("résumé des langues d'une bibliothèque", () => {
  it("rien de choisi : pas de résumé", () => {
    expect(summarizeLibraryPref(null, t)).toBeNull();
    expect(summarizeLibraryPref({ audioLang: null, subtitleLang: null, subtitleMode: "none" }, t)).toBeNull();
  });

  it("audio et sous-titres, avec leur mode", () => {
    expect(summarizeLibraryPref({ audioLang: "jpn", subtitleLang: "fre", subtitleMode: "always" }, t))
      .toBe("audio : langJa · subtitles : langFr (modeAlwaysOn)");
  });

  it("« VO » (langue originale du titre, Jellyfin 12) se nomme comme telle", () => {
    expect(summarizeLibraryPref({ audioLang: "original", subtitleLang: null, subtitleMode: "none" }, t))
      .toBe("audio : langOriginal");
  });

  it("des sous-titres désactivés ne s'annoncent pas", () => {
    expect(summarizeLibraryPref({ audioLang: "eng", subtitleLang: "fre", subtitleMode: "none" }, t))
      .toBe("audio : langEn");
  });
});
