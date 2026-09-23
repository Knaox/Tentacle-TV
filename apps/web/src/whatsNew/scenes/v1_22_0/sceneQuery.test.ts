import { describe, expect, it } from "vitest";
import { sceneQueryFor } from "./sceneQuery";

describe("la requête de la scène de recherche", () => {
  it("inverse deux lettres voisines vers la fin du mot le plus long", () => {
    expect(sceneQueryFor("Inception")).toEqual({ typed: "inceptino", corrected: "inception", terms: ["inception"] });
    expect(sceneQueryFor("Da Vinci Code")).toEqual({ typed: "da vinic", corrected: "da vinci", terms: ["da", "vinci"] });
  });

  it("tape le titre plié, comme le moteur le lit", () => {
    expect(sceneQueryFor("Pokémon")).toEqual({ typed: "pokemno", corrected: "pokemon", terms: ["pokemon"] });
  });

  it("va chercher un troisième mot quand les deux premiers sont trop courts pour une faute", () => {
    expect(sceneQueryFor("The Dark Knight")).toEqual({
      typed: "the dark knigth",
      corrected: "the dark knight",
      terms: ["the", "dark", "knight"],
    });
  });

  it("ne fait aucune faute là où le moteur n'en corrigerait pas", () => {
    expect(sceneQueryFor("Up")).toEqual({ typed: "up", corrected: null, terms: ["up"] });
    expect(sceneQueryFor("")).toEqual({ typed: "", corrected: null, terms: [] });
  });

  it("s'arrête à deux mots quand l'un d'eux peut porter la faute", () => {
    expect(sceneQueryFor("Blade Runner 2049")).toEqual({
      typed: "blade runnre",
      corrected: "blade runner",
      terms: ["blade", "runner"],
    });
  });
});
