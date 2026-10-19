import { describe, expect, it } from "vitest";
import { libraryGroupCandidates, libraryGroupsFromCounts, type LibraryGroupContext } from "./libraryGroups";

const CTX: LibraryGroupContext = {
  genres: [
    { id: "g-action", name: "Action" },
    { id: "g-drame", name: "Drame" },
    { id: "g-western", name: "Western" },
    { id: "g-musical", name: "Musical" },
  ],
  currentYear: 2026,
  genreIds: [],
  yearFrom: null,
  yearTo: null,
  ratingMin: null,
};

describe("les rangées d'une bibliothèque", () => {
  it("par genre : les plus gros d'abord, jamais une rangée vide, les petits réunis (l'un OU l'autre)", () => {
    const candidates = libraryGroupCandidates("genre", CTX);
    expect(candidates.map((c) => c.query.genreIds)).toEqual([["g-action"], ["g-drame"], ["g-western"], ["g-musical"]]);
    // Tant qu'un compte manque, l'ordre n'est pas connu : rien.
    expect(libraryGroupsFromCounts("genre", candidates, [12, undefined, 1, 2])).toBeNull();
    const groups = libraryGroupsFromCounts("genre", candidates, [12, 40, 1, 2]) ?? [];
    expect(groups.map((g) => g.key)).toEqual(["genre:g-drame", "genre:g-action", "genre:other"]);
    expect(groups[2].query.genreIds).toEqual(["g-western", "g-musical"]);
    expect(libraryGroupsFromCounts("genre", candidates, [12, 40, 0, 0])?.map((g) => g.key)).toEqual(["genre:g-drame", "genre:g-action"]);
  });

  it("un genre filtré ne garde que ses rangées", () => {
    expect(libraryGroupCandidates("genre", { ...CTX, genreIds: ["g-drame"] }).map((c) => c.key)).toEqual(["genre:g-drame"]);
  });

  it("par décennie : de la plus récente à 1970, puis « Avant 1970 » — réduites à la plage filtrée", () => {
    const all = libraryGroupCandidates("year", CTX);
    expect(all.map((c) => c.key)).toEqual(["year:2020", "year:2010", "year:2000", "year:1990", "year:1980", "year:1970", "year:before"]);
    expect(all[0].query.years).toEqual([2020, 2021, 2022, 2023, 2024, 2025, 2026]);
    const span = libraryGroupCandidates("year", { ...CTX, yearFrom: 2005, yearTo: 2012 });
    expect(span.map((c) => c.query.years)).toEqual([[2010, 2011, 2012], [2005, 2006, 2007, 2008, 2009]]);
  });

  it("par lettres : des bornes en minuscules, la dernière tranche ouverte, « 0 – 9 » avant le « a »", () => {
    const candidates = libraryGroupCandidates("alpha", CTX);
    expect(candidates[0].query).toEqual({ nameFrom: "a", nameBefore: "d" });
    expect(candidates[7].query).toEqual({ nameFrom: "v" });
    expect(candidates[8]).toMatchObject({ label: { kind: "digits" }, query: { nameBefore: "a" } });
  });

  it("par note : des comptes cumulés, chaque palier une tranche de la liste triée par note", () => {
    const candidates = libraryGroupCandidates("rating", CTX);
    expect(candidates.map((c) => c.query.minRating)).toEqual([8, 7, 6, 0.1]);
    expect(candidates.map((c) => c.label.kind)).toEqual(["ratingAtLeast", "ratingBetween", "ratingBetween", "ratingBelow"]);
    // ≥ 8 : 10 ; ≥ 7 : 25 ; ≥ 6 : 25 (aucun entre 6 et 7) ; > 0 : 31.
    const groups = libraryGroupsFromCounts("rating", candidates, [10, 25, 25, 31]) ?? [];
    expect(groups.map((g) => [g.key, g.count, g.slice])).toEqual([
      ["rating:8", 10, { offset: 0, limit: 10 }],
      ["rating:7", 15, { offset: 10, limit: 15 }],
      ["rating:0.1", 6, { offset: 25, limit: 6 }],
    ]);
  });

  it("une note minimale filtrée devient le bas du dernier palier", () => {
    const candidates = libraryGroupCandidates("rating", { ...CTX, ratingMin: 6.5 });
    expect(candidates.map((c) => c.query.minRating)).toEqual([8, 7, 6.5]);
    expect(candidates[2].label).toEqual({ kind: "ratingBetween", min: 6.5, max: 7 });
  });
});
