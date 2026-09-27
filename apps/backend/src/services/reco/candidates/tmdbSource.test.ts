import { describe, expect, it } from "vitest";
import { genresFor } from "./tmdbSource";

describe("genres de /discover par type", () => {
  it("traduit les genres du profil dans la liste du type interrogé", () => {
    // Profil mêlé : SF (film), Action & Adventure (série), Drame (commun), Romance (film seul).
    const profile = [878, 10759, 18, 10749, 28];
    expect(genresFor("movie", profile, 3)).toEqual([878, 28, 18]);
    expect(genresFor("tv", profile, 3)).toEqual([10765, 10759, 18]);
  });

  it("écarte les genres propres à l'autre type (téléréalité pour un film)", () => {
    expect(genresFor("movie", [10764, 35], 3)).toEqual([35]);
    expect(genresFor("tv", [27, 80], 3)).toEqual([80]);
  });
});
