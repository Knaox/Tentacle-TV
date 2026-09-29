import { describe, expect, it } from "vitest";
import { parseLibraryLanguages } from "./libraryLanguages";

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
