import { describe, expect, it } from "vitest";
import { distinctSeasonName, seasonTitle } from "./seasonTitle";

const WORDS: Record<string, string> = {
  "requests:seasonSpecials": "Spéciaux",
  "requests:seasonFallback": "Saison {{number}}",
  "requests:seasonNamed": "{{season}} · {{name}}",
};
const t = (key: string, options?: Record<string, unknown>) =>
  (WORDS[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(options?.[name] ?? ""));

describe("le nom d'une saison sur la TV", () => {
  it("dit « Saison N » et « Spéciaux » dans les mots de l'interface", () => {
    expect(seasonTitle(t, 3)).toBe("Saison 3");
    expect(seasonTitle(t, 0)).toBe("Spéciaux");
    expect(seasonTitle(t, 12, null)).toBe("Saison 12");
  });

  it("n'ajoute pas un nom générique, quelle qu'en soit la langue", () => {
    for (const name of ["Season 3", "Saison 3", "saison 03", "Staffel 3", "Temporada 3", "S3", "3", "  Season 3  "]) {
      expect(seasonTitle(t, 3, name), name).toBe("Saison 3");
    }
    for (const name of ["Specials", "Special", "Épisodes spéciaux", "Spéciaux", "Episodios especiales", "Extras", "Season 0"]) {
      expect(seasonTitle(t, 0, name), name).toBe("Spéciaux");
    }
  });

  it("ajoute le nom d'une saison qui en a un vrai", () => {
    expect(seasonTitle(t, 1, "Book One: Water")).toBe("Saison 1 · Book One: Water");
    expect(seasonTitle(t, 2, "Le Retour")).toBe("Saison 2 · Le Retour");
    expect(seasonTitle(t, 0, "OAV")).toBe("Spéciaux · OAV");
  });

  it("garde un nom qui porte un AUTRE numéro : il dit autre chose", () => {
    expect(distinctSeasonName(2, "Season 1")).toBe("Season 1");
    expect(distinctSeasonName(4, "Part 2")).toBe("Part 2");
  });
});
