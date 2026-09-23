import { describe, expect, it } from "vitest";
import { parseSearchQuery } from "../../search/searchText";
import { PEOPLE, sampleCatalog } from "../../../test/searchCatalog";
import { SearchEngine, correctionOf } from "./engine";

/**
 * Le moteur, sur une petite bibliothèque : ce qui se garde, c'est ce qu'un
 * humain tape vraiment — des fautes, sans accents, dans le désordre, soudé,
 * en chiffres — et que le moteur retrouve quand même ce qu'il voulait.
 */

const engine = new SearchEngine(sampleCatalog());

function names(query: string): string[] {
  return engine.searchItems(parseSearchQuery(query), "AND").map((c) => engine.items.get(c.id)?.name ?? "?");
}

describe("SearchEngine.searchItems", () => {
  it("pardonne les fautes : « hary poter »", () => {
    expect(names("hary poter")).toContain("Harry Potter à l'école des sorciers");
  });

  it("rattrape deux lettres inversées à la passe large : « forrset »", () => {
    const loose = engine.searchItems(parseSearchQuery("frorest"), "AND", true);
    expect(loose.map((c) => engine.items.get(c.id)?.name)).toContain("Forrest Gump");
  });

  it("ignore accents et ligatures", () => {
    expect(names("pokemon")).toContain("Pokémon, le film");
    expect(names("oeil tigre")).toContain("L'Œil du tigre");
  });

  it("accepte les mots dans le désordre", () => {
    expect(names("potter harry")).toContain("Harry Potter et la Chambre des secrets");
  });

  it("trouve un titre à trait d'union tapé soudé", () => {
    expect(names("spiderman")).toContain("Spider-Man: No Way Home");
  });

  it("lit les numéros dans les deux écritures", () => {
    expect(names("rocky 2")).toContain("Rocky II");
  });

  it("trouve pendant la frappe : préfixes", () => {
    expect(names("forr")).toContain("Forrest Gump");
  });

  it("cherche aussi le titre original", () => {
    expect(names("philosopher stone")).toContain("Harry Potter à l'école des sorciers");
  });

  it("garde exacts les mots de trois lettres : « it » ne devient pas « at »", () => {
    expect(names("it")).toContain("It");
  });

  it("trouve par le casting, et dit qui a fait trouver", () => {
    const found = engine.searchItems(parseSearchQuery("tom hanks"), "AND");
    const forrest = found.find((c) => engine.items.get(c.id)?.name === "Forrest Gump");
    expect(forrest?.match).toEqual({ field: "people", value: "Tom Hanks", role: "Actor" });
  });

  it("dit « titre » quand le titre répond à tous les termes", () => {
    const [first] = engine.searchItems(parseSearchQuery("forrest gump"), "AND");
    expect(first?.match).toEqual({ field: "title" });
    expect(first?.exactTitle).toBe(true);
  });

  it("refuse deux fautes dans deux champs : « star wars » ne trouve pas Seul sur Mars par Sebastian Stan", () => {
    expect(names("star wars")).not.toContain("Seul sur Mars");
    expect(engine.searchItems(parseSearchQuery("star wars"), "AND", true)).toEqual([]);
  });

  it("ne tolère la faute que dans le titre : « dune » ne ramène pas les films de June Squibb", () => {
    expect(names("dune")).not.toContain("Nebraska");
    expect(names("dune")).toEqual(expect.arrayContaining(["Dune"]));
  });

  it("accepte des termes justes dans des champs différents : « zemeckis gump »", () => {
    expect(names("zemeckis gump")).toContain("Forrest Gump");
  });
});

describe("SearchEngine.searchPersons", () => {
  it("trouve une personne par son nom, même mal tapé — lettres inversées à la passe large", () => {
    expect(engine.searchPersons(parseSearchQuery("tom hansk"))).toEqual([]);
    const [first] = engine.searchPersons(parseSearchQuery("tom hansk"), true);
    expect(first?.id).toBe(PEOPLE.hanks.id);
    expect(first?.fullNameMatch).toBe(false);
    expect(engine.searchPersons(parseSearchQuery("tom hanks"))[0]?.fullNameMatch).toBe(true);
  });

  it("tient le compte des rôles et des titres", () => {
    const zemeckis = engine.persons.get(PEOPLE.zemeckis.id);
    expect(zemeckis?.itemIds).toHaveLength(2);
    expect(zemeckis?.roles.get("Director")).toBe(2);
  });
});

describe("SearchEngine.matchGenres", () => {
  it("propose les genres dont chaque terme commence un mot", () => {
    expect(engine.matchGenres(parseSearchQuery("com")).map((g) => g.name)).toEqual(["Comédie"]);
    expect(engine.matchGenres(parseSearchQuery("science fi")).map((g) => g.name)).toEqual(["Science-Fiction"]);
  });
});

describe("correctionOf", () => {
  function corrected(query: string): string | null {
    const parsed = parseSearchQuery(query);
    const [first] = engine.searchItems(parsed, "AND", true);
    return first === undefined ? null : correctionOf(parsed, first.analysis.corrections);
  }

  it("corrige MOT À MOT, depuis les vrais mots du titre trouvé", () => {
    expect(corrected("hary poter")).toBe("harry potter");
    expect(corrected("le seigneur des aneaux")).toBeNull();
  });

  it("se tait quand tout est juste, ou que la frappe est en cours", () => {
    expect(corrected("harry potter")).toBeNull();
    expect(corrected("harry pott")).toBeNull();
  });

  it("garde les mots vides de la saisie", () => {
    const parsed = parseSearchQuery("the ofice");
    expect(correctionOf(parsed, new Map([["ofice", "office"]]))).toBe("the office");
  });
});
