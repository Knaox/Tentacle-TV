import { describe, it, expect } from "vitest";
import {
  normaliserRecherche,
  termeDeRepli,
  scoreRecherche,
  correspondALaRecherche,
} from "./rechercheTexte";

describe("normaliserRecherche", () => {
  it("retire les accents et la casse", () => {
    expect(normaliserRecherche("Le Destin d'un HÉROS")).toBe("le destin d un heros");
  });

  it("ramène toute ponctuation à une espace, sans en laisser traîner", () => {
    expect(normaliserRecherche("  Spider-Man :  No Way Home!  ")).toBe("spider man no way home");
  });

  it("préserve les alphabets non latins", () => {
    // Une classe Unicode générique les aurait effacés — un titre japonais
    // deviendrait une chaîne vide, donc introuvable.
    expect(normaliserRecherche("君の名は。")).toBe("君の名は");
  });

  it("garde les chiffres", () => {
    expect(normaliserRecherche("Blade Runner 2049")).toBe("blade runner 2049");
  });
});

describe("termeDeRepli", () => {
  it("LA propriété : un seul mot ne déclenche aucune seconde requête", () => {
    // Sans ça, chaque recherche coûterait deux allers-retours au lieu d'un.
    expect(termeDeRepli("batman")).toBeNull();
    expect(termeDeRepli("  batman  ")).toBeNull();
    expect(termeDeRepli("")).toBeNull();
  });

  it("retient le mot le plus long, le plus discriminant", () => {
    expect(termeDeRepli("Spider Man")).toBe("spider");
    expect(termeDeRepli("The Amazing Spider Man")).toBe("amazing");
  });

  it("un terme ponctué compte comme plusieurs mots", () => {
    // C'est tout l'intérêt : « Spider-Man » ne rend rien de plus, mais si la
    // recherche échoue, « spider » reste une porte de sortie.
    expect(termeDeRepli("Spider-Man")).toBe("spider");
  });

  it("renonce quand il ne reste que des mots trop courts", () => {
    expect(termeDeRepli("de la")).toBeNull();
  });
});

describe("scoreRecherche", () => {
  it("classe l'exact au-dessus du préfixe, lui-même au-dessus du reste", () => {
    const exact = scoreRecherche("Spider-Man", "spider man");
    const prefixe = scoreRecherche("Spider-Man : No Way Home", "spider man");
    const dedans = scoreRecherche("The Amazing Spider-Man", "spider man");
    expect(exact).toBeGreaterThan(prefixe);
    expect(prefixe).toBeGreaterThan(dedans);
    expect(dedans).toBeGreaterThan(0);
  });

  it("LE cas signalé : « Spider Man » reconnaît « Spider-Man »", () => {
    expect(scoreRecherche("Spider-Man : Homecoming", "Spider Man")).toBeGreaterThan(0);
  });

  it("écarte ce que seul le terme de repli avait remonté", () => {
    // « spider » remonte huit titres ; ceux-ci ne répondent pas à la saisie.
    expect(scoreRecherche("Les Nouveaux Héros", "spider man")).toBe(0);
    expect(scoreRecherche("Spiderwick", "spider man")).toBe(0);
  });

  it("rattrape ce que la saisie a soudé ou disjoint", () => {
    // L'apostrophe fait deux mots de « d'un » : sans ce palier, une saisie
    // « destin dun heros » ne reconnaissait pas son propre film.
    expect(scoreRecherche("The Amazing Spider-Man : Le Destin d'un héros", "destin dun heros"))
      .toBeGreaterThan(0);
    expect(scoreRecherche("Spider-Man : Homecoming", "spiderman")).toBeGreaterThan(0);
    // Et ça ne doit pas ouvrir la porte à n'importe quoi.
    expect(scoreRecherche("Indiana Jones et le Cadran de la destinée", "destin dun heros")).toBe(0);
  });

  it("accepte les mots dispersés et dans le désordre", () => {
    expect(scoreRecherche("The Amazing Spider-Man : Le Destin d'un héros", "heros destin"))
      .toBeGreaterThan(0);
  });

  it("à palier égal, le titre le plus court passe devant", () => {
    const court = scoreRecherche("Spider-Man", "spider");
    const long = scoreRecherche("Spider-Man : Across the Spider-Verse", "spider");
    expect(court).toBeGreaterThan(long);
  });

  it("le départage ne fait jamais franchir un palier", () => {
    // Un titre à rallonge qui contient exactement le terme doit rester
    // au-dessus d'un titre bref où les mots sont seulement dispersés.
    const dedans = scoreRecherche("A".repeat(200) + " spider man", "spider man");
    const epars = scoreRecherche("man spider", "spider man");
    expect(dedans).toBeGreaterThan(epars);
  });

  it("une saisie ou un candidat vide ne vaut rien", () => {
    expect(scoreRecherche("", "spider")).toBe(0);
    expect(scoreRecherche("Spider-Man", "")).toBe(0);
  });
});

describe("correspondALaRecherche", () => {
  it("une recherche vide laisse tout passer", () => {
    expect(correspondALaRecherche("n'importe quoi", "   ")).toBe(true);
  });

  it("ignore accents, casse et ponctuation", () => {
    expect(correspondALaRecherche("Amélie Poulain", "amelie")).toBe(true);
    expect(correspondALaRecherche("L'Œil du tigre", "oeil")).toBe(false);
    expect(correspondALaRecherche("Jean-Luc", "jean luc")).toBe(true);
  });
});
