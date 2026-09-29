import { describe, expect, it } from "vitest";
import { languageValues, parseLibraryLanguages } from "./libraryLanguages";

describe("parseLibraryLanguages", () => {
  it("regroupe les codes d'une même langue (fre/fra) sous un code stable", () => {
    const out = parseLibraryLanguages({
      AudioLanguages: [{ Name: "French (fre)", Value: "fre" }, { Name: "French (fra)", Value: "fra" }, { Name: "Japanese (jpn)", Value: "jpn" }],
      SubtitleLanguages: [{ Name: "English (eng)", Value: "eng" }],
    });
    expect(out).toEqual({
      audio: [{ code: "fr", values: ["fre", "fra"] }, { code: "ja", values: ["jpn"] }],
      subtitle: [{ code: "en", values: ["eng"] }],
    });
  });

  it("null quand le serveur ne rend pas de langues (avant Jellyfin 12) : pas de filtre", () => {
    expect(parseLibraryLanguages({})).toBeNull();
    expect(parseLibraryLanguages({ Genres: [] })).toBeNull();
    expect(parseLibraryLanguages(null)).toBeNull();
  });

  it("une liste vide reste une capacité : le serveur sait filtrer, il n'y a rien", () => {
    expect(parseLibraryLanguages({ AudioLanguages: [], SubtitleLanguages: [] })).toEqual({ audio: [], subtitle: [] });
  });
});

describe("languageValues", () => {
  const options = [{ code: "fr", values: ["fre", "fra"] }, { code: "ja", values: ["jpn"] }];

  it("rend tous les codes Jellyfin de la langue choisie", () => {
    expect(languageValues(options, "fr")).toEqual(["fre", "fra"]);
  });

  it("rien sans choix, sans liste, ou pour une langue absente", () => {
    expect(languageValues(options, null)).toBeUndefined();
    expect(languageValues(undefined, "fr")).toBeUndefined();
    expect(languageValues(options, "ko")).toBeUndefined();
  });
});
