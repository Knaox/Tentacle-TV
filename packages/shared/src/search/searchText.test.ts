import { describe, expect, it } from "vitest";
import { foldForSearch, parseSearchQuery, searchTokens, titleVariants } from "./searchText";
import { highlightRanges, inlineCompletion } from "./searchHighlight";

describe("foldForSearch", () => {
  it("plie accents, casse, ponctuation — et les ligatures que NFD laisse entières", () => {
    expect(foldForSearch("L'Œil du Tigre")).toBe("l oeil du tigre");
    expect(foldForSearch("Pokémon™ : Le Film")).toBe("pokemon le film");
    expect(foldForSearch("Æon Flux")).toBe("aeon flux");
    expect(foldForSearch("Straße")).toBe("strasse");
  });

  it("garde les alphabets non latins", () => {
    expect(foldForSearch("千と千尋の神隠し")).toBe("千と千尋の神隠し");
  });
});

describe("titleVariants", () => {
  it("soude les paires : « spider-man » se trouve par « spiderman »", () => {
    expect(titleVariants(searchTokens("Spider-Man: No Way Home"))).toContain("spiderman");
    expect(titleVariants(searchTokens("WALL·E"))).toContain("walle");
  });

  it("traduit les numéros dans les deux sens, jamais une lettre seule", () => {
    expect(titleVariants(searchTokens("Rocky II"))).toContain("2");
    expect(titleVariants(searchTokens("Toy Story 3"))).toContain("iii");
    expect(titleVariants(searchTokens("Malcolm X"))).not.toContain("10");
    expect(titleVariants(searchTokens("V pour Vendetta"))).not.toContain("5");
  });

  it("ne soude jamais un mot vide : pas de mot fantôme", () => {
    expect(titleVariants(searchTokens("Harry Potter à l'école"))).not.toContain("pottera");
    expect(titleVariants(searchTokens("X-Men"))).toContain("xmen");
  });

  it("ne répète pas les mots du titre", () => {
    expect(titleVariants(["alien"])).toEqual([]);
  });
});

describe("parseSearchQuery", () => {
  it("n'exige les mots vides que s'ils sont seuls", () => {
    expect(parseSearchQuery("The Office").terms).toEqual(["office"]);
    expect(parseSearchQuery("fast and furious").terms).toEqual(["fast", "furious"]);
    expect(parseSearchQuery("It").terms).toEqual(["it"]);
  });

  it("fait d'une année citée un indice, et la garde quand elle est seule", () => {
    expect(parseSearchQuery("dune 2021")).toMatchObject({ terms: ["dune"], year: 2021 });
    expect(parseSearchQuery("1917")).toMatchObject({ terms: ["1917"], year: null });
  });

  it("lit un indice de type : « film avec Tom Hanks »", () => {
    expect(parseSearchQuery("film avec Tom Hanks")).toMatchObject({ terms: ["tom", "hanks"], type: "Movie" });
    expect(parseSearchQuery("série breaking bad")).toMatchObject({ terms: ["breaking", "bad"], type: "Series" });
  });
});

describe("highlightRanges", () => {
  it("revient du plié à l'original, accents et ligatures compris", () => {
    expect(highlightRanges("Pokémon", ["pokem"])).toEqual([[0, 5]]);
    expect(highlightRanges("L'Œil du tigre", ["oeil"])).toEqual([[2, 5]]);
  });

  it("ne surligne que des débuts de mot", () => {
    expect(highlightRanges("Spider-Man", ["man"])).toEqual([[7, 10]]);
    expect(highlightRanges("Batman", ["man"])).toEqual([]);
  });

  it("fusionne et ordonne les plages", () => {
    expect(highlightRanges("Harry Potter", ["potter", "harry"])).toEqual([[0, 5], [6, 12]]);
  });
});

describe("inlineCompletion", () => {
  it("complète un titre qui commence par la saisie, casse mise à part", () => {
    expect(inlineCompletion("stra", "Stranger Things")).toBe("nger Things");
  });

  it("ne réécrit jamais ce qui a été tapé", () => {
    expect(inlineCompletion("pokem", "Pokémon")).toBeNull();
    expect(inlineCompletion("things", "Stranger Things")).toBeNull();
    expect(inlineCompletion("", "Alien")).toBeNull();
  });
});
