import { describe, it, expect } from "vitest";
import {
  normalizeSearch,
  fallbackTerm,
  searchScore,
  matchesSearch,
} from "./textSearch";

describe("normalizeSearch", () => {
  it("retire les accents et la casse", () => {
    expect(normalizeSearch("Le Destin d'un HÉROS")).toBe("le destin d un heros");
  });

  it("ramène toute ponctuation à une espace, sans en laisser traîner", () => {
    expect(normalizeSearch("  Spider-Man :  No Way Home!  ")).toBe("spider man no way home");
  });

  it("préserve les alphabets non latins", () => {
    // Une classe Unicode générique les aurait effacés — un titre japonais
    // deviendrait une chaîne vide, donc introuvable.
    expect(normalizeSearch("君の名は。")).toBe("君の名は");
  });

  it("garde les chiffres", () => {
    expect(normalizeSearch("Blade Runner 2049")).toBe("blade runner 2049");
  });
});

describe("fallbackTerm", () => {
  it("LA propriété : un seul mot ne déclenche aucune seconde requête", () => {
    // Sans ça, chaque recherche coûterait deux allers-retours au lieu d'un.
    expect(fallbackTerm("batman")).toBeNull();
    expect(fallbackTerm("  batman  ")).toBeNull();
    expect(fallbackTerm("")).toBeNull();
  });

  it("retient le mot le plus long, le plus discriminant", () => {
    expect(fallbackTerm("Spider Man")).toBe("spider");
    expect(fallbackTerm("The Amazing Spider Man")).toBe("amazing");
  });

  it("un terme ponctué compte comme plusieurs mots", () => {
    // C'est tout l'intérêt : « Spider-Man » ne rend rien de plus, mais si la
    // recherche échoue, « spider » reste une porte de sortie.
    expect(fallbackTerm("Spider-Man")).toBe("spider");
  });

  it("renonce quand il ne reste que des mots trop courts", () => {
    expect(fallbackTerm("de la")).toBeNull();
  });
});

describe("searchScore", () => {
  it("classe l'exact au-dessus du préfixe, lui-même au-dessus du reste", () => {
    const exact = searchScore("Spider-Man", "spider man");
    const prefix = searchScore("Spider-Man : No Way Home", "spider man");
    const inside = searchScore("The Amazing Spider-Man", "spider man");
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(inside);
    expect(inside).toBeGreaterThan(0);
  });

  it("LE cas signalé : « Spider Man » reconnaît « Spider-Man »", () => {
    expect(searchScore("Spider-Man : Homecoming", "Spider Man")).toBeGreaterThan(0);
  });

  it("écarte ce que seul le terme de repli avait remonté", () => {
    // « spider » remonte huit titres ; ceux-ci ne répondent pas à la saisie.
    expect(searchScore("Les Nouveaux Héros", "spider man")).toBe(0);
    expect(searchScore("Spiderwick", "spider man")).toBe(0);
  });

  it("rattrape ce que la saisie a soudé ou disjoint", () => {
    // L'apostrophe fait deux mots de « d'un » : sans ce palier, une saisie
    // « destin dun heros » ne reconnaissait pas son propre film.
    expect(searchScore("The Amazing Spider-Man : Le Destin d'un héros", "destin dun heros"))
      .toBeGreaterThan(0);
    expect(searchScore("Spider-Man : Homecoming", "spiderman")).toBeGreaterThan(0);
    // Et ça ne doit pas ouvrir la porte à n'importe quoi.
    expect(searchScore("Indiana Jones et le Cadran de la destinée", "destin dun heros")).toBe(0);
  });

  it("accepte les mots dispersés et dans le désordre", () => {
    expect(searchScore("The Amazing Spider-Man : Le Destin d'un héros", "heros destin"))
      .toBeGreaterThan(0);
  });

  it("à palier égal, le titre le plus court passe devant", () => {
    const short = searchScore("Spider-Man", "spider");
    const long = searchScore("Spider-Man : Across the Spider-Verse", "spider");
    expect(short).toBeGreaterThan(long);
  });

  it("le départage ne fait jamais franchir un palier", () => {
    // Un titre à rallonge qui contient exactement le terme doit rester
    // au-dessus d'un titre bref où les mots sont seulement dispersés.
    const inside = searchScore("A".repeat(200) + " spider man", "spider man");
    const scattered = searchScore("man spider", "spider man");
    expect(inside).toBeGreaterThan(scattered);
  });

  it("une saisie ou un candidat vide ne vaut rien", () => {
    expect(searchScore("", "spider")).toBe(0);
    expect(searchScore("Spider-Man", "")).toBe(0);
  });
});

describe("matchesSearch", () => {
  it("une recherche vide laisse tout passer", () => {
    expect(matchesSearch("n'importe quoi", "   ")).toBe(true);
  });

  it("ignore accents, casse et ponctuation", () => {
    expect(matchesSearch("Amélie Poulain", "amelie")).toBe(true);
    expect(matchesSearch("L'Œil du tigre", "oeil")).toBe(false);
    expect(matchesSearch("Jean-Luc", "jean luc")).toBe(true);
  });
});
