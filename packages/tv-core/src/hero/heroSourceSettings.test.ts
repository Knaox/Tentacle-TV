import { describe, expect, it } from "vitest";
import { heroSourcePress, settingsHeroKey } from "./heroSourceSettings";

describe("Réglages › Personnalisation : OK sur une source du bandeau", () => {
  it("une autre source s'écrit aussitôt", () => {
    expect(heroSourcePress("recoMovies", { current: "reco", favorites: 3 })).toEqual({ kind: "save", mode: "recoMovies" });
    expect(heroSourcePress("resume", { current: "fixed", favorites: 0 })).toEqual({ kind: "save", mode: "resume" });
  });

  it("« Un titre choisi » ouvre les favoris : jamais un bandeau fixe sans titre", () => {
    expect(heroSourcePress("fixed", { current: "resume", favorites: 4 })).toEqual({ kind: "pickFixed" });
    // Favoris pas encore lus : la liste s'ouvre et se remplit.
    expect(heroSourcePress("fixed", { current: "resume", favorites: null })).toEqual({ kind: "pickFixed" });
  });

  it("sans aucun favori, la section le dit au lieu d'ouvrir une liste vide", () => {
    expect(heroSourcePress("fixed", { current: "reco", favorites: 0 })).toEqual({ kind: "noFavorites" });
  });

  it("la source déjà retenue : rien", () => {
    expect(heroSourcePress("recoSeries", { current: "recoSeries", favorites: 2 })).toEqual({ kind: "none" });
    expect(heroSourcePress("fixed", { current: "fixed", favorites: 2 })).toEqual({ kind: "none" });
  });

  it("une clé de focus par source", () => {
    expect(settingsHeroKey("recoMovies")).toBe("settings:hero:recoMovies");
  });
});
