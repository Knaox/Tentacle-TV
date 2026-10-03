import { describe, expect, it } from "vitest";
import { cardPressOf } from "./cardPress";

describe("cardPressOf — ce que fait OK sur une carte", () => {
  it("l'accueil : les vignettes d'épisodes se lisent, les affiches ouvrent la fiche (une reco : celle de son item)", () => {
    for (const row of ["resume", "nextUp", "watched"] as const) expect(cardPressOf({ surface: "homeRow", row })).toBe("play");
    for (const row of ["watchlist", "favorites", "library", "reco"] as const) expect(cardPressOf({ surface: "homeRow", row })).toBe("detail");
  });

  it("« Pour vous » et les grilles : la fiche", () => {
    expect(cardPressOf({ surface: "forYou" })).toBe("detail");
    expect(cardPressOf({ surface: "grid" })).toBe("detail");
  });

  it("la recherche : l'épisode se lit, le titre ouvre sa fiche, l'absent et la série à compléter se demandent", () => {
    expect(cardPressOf({ surface: "search", card: "episode" })).toBe("play");
    expect(cardPressOf({ surface: "search", card: "title" })).toBe("detail");
    expect(cardPressOf({ surface: "search", card: "absentTitle" })).toBe("request");
    expect(cardPressOf({ surface: "search", card: "librarySeries" })).toBe("request");
  });

  it("la fiche : l'épisode se lit, un volet absent se demande s'il le peut, sinon l'avis", () => {
    expect(cardPressOf({ surface: "detail", card: "episode" })).toBe("play");
    for (const card of ["sagaPresent", "similar", "collection"] as const) expect(cardPressOf({ surface: "detail", card })).toBe("detail");
    expect(cardPressOf({ surface: "detail", card: "sagaAbsent", requestable: true })).toBe("request");
    expect(cardPressOf({ surface: "detail", card: "sagaAbsent" })).toBe("notInLibrary");
  });
});
