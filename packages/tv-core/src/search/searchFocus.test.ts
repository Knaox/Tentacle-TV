import { describe, expect, it } from "vitest";
import {
  SEARCH_ENTRY_KEY,
  SEARCH_KEYBOARD_CLOSED_KEY,
  searchCardPress,
  searchFirstResultKey,
  searchRemembers,
  searchTopPress,
} from "./searchFocus";

describe("entrée et clavier", () => {
  it("arrive sur la première touche du clavier à l'écran, pas sur le champ", () => {
    expect(SEARCH_ENTRY_KEY).toBe("key:A");
  });

  it("Menu, qui ferme le clavier système sans valider, rend la première touche", () => {
    expect(SEARCH_KEYBOARD_CLOSED_KEY).toBe("key:A");
  });
});

describe("premier résultat", () => {
  it("le meilleur résultat d'abord", () => {
    expect(searchFirstResultKey(["top", "movies", "people"])).toBe("top");
  });

  it("sinon la première carte de la première rangée, quelle qu'elle soit", () => {
    expect(searchFirstResultKey(["movies", "series"])).toBe("movies:0");
    expect(searchFirstResultKey(["people"])).toBe("people:0");
    expect(searchFirstResultKey(["facets"])).toBe("facets:0");
    expect(searchFirstResultKey(["episodes"])).toBe("episodes:0");
  });

  it("la rangée « À demander » seule est un premier résultat comme un autre", () => {
    expect(searchFirstResultKey(["absent"])).toBe("absent:0");
  });

  it("aucune rangée : rien", () => {
    expect(searchFirstResultKey([])).toBeNull();
  });
});

describe("OK sur un résultat", () => {
  it("une vignette d'épisode lit, une affiche ouvre sa fiche, « À demander » demande", () => {
    expect(searchCardPress("episodes")).toBe("play");
    expect(searchCardPress("movies")).toBe("detail");
    expect(searchCardPress("series")).toBe("detail");
    expect(searchCardPress("collections")).toBe("detail");
    expect(searchCardPress("absent")).toBe("request");
  });

  it("le meilleur résultat : une personne, sa filmographie ; un titre, sa fiche", () => {
    expect(searchTopPress("person")).toBe("browse");
    expect(searchTopPress("item")).toBe("detail");
    expect(searchTopPress("title")).toBe("detail");
  });
});

describe("recherches récentes", () => {
  it("seule la sélection d'un RÉSULTAT mémorise, à partir de deux caractères", () => {
    expect(searchRemembers("result", "du")).toBe(true);
    expect(searchRemembers("result", "d")).toBe(false);
    expect(searchRemembers("discoverGenre", "dune")).toBe(false);
    expect(searchRemembers("suggestion", "dune")).toBe(false);
  });
});
