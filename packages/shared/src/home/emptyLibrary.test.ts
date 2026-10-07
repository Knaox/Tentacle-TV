import { describe, expect, it } from "vitest";
import { libraryHasNoTitles } from "./emptyLibrary";

describe("libraryHasNoTitles", () => {
  it("se tait tant que les bibliothèques ne sont pas connues", () => {
    expect(libraryHasNoTitles(undefined)).toBe(false);
  });

  it("aucune bibliothèque : vide", () => {
    expect(libraryHasNoTitles([])).toBe(true);
  });

  it("des bibliothèques vidéo sans film ni série : vide", () => {
    expect(
      libraryHasNoTitles([
        { Id: "a", Name: "Films", CollectionType: "movies", RecursiveItemCount: 0, ChildCount: 0 },
        { Id: "b", Name: "Séries", CollectionType: "tvshows", RecursiveItemCount: 0 },
      ]),
    ).toBe(true);
  });

  it("un seul titre suffit", () => {
    expect(
      libraryHasNoTitles([
        { Id: "a", Name: "Films", CollectionType: "movies", RecursiveItemCount: 0 },
        { Id: "b", Name: "Séries", CollectionType: "tvshows", RecursiveItemCount: 3 },
      ]),
    ).toBe(false);
  });

  it("la musique compte par ses enfants, pas par le filtre films/séries", () => {
    expect(
      libraryHasNoTitles([{ Id: "m", Name: "Musique", CollectionType: "music", RecursiveItemCount: 0, ChildCount: 12 }]),
    ).toBe(false);
  });

  it("un décompte inconnu ne vaut jamais vide", () => {
    expect(libraryHasNoTitles([{ Id: "a", Name: "Films", CollectionType: "movies" }])).toBe(false);
  });
});
