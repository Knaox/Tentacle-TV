import { describe, expect, it } from "vitest";
import fr from "./locales/fr/homeSettings";
import en from "./locales/en/homeSettings";

/**
 * Les mots de Réglages › Personnalisation (accueil) : mêmes clés dans les deux
 * langues, aucune vide, et l'espace insécable française devant « : ».
 */
describe("vocabulaire de la personnalisation de l'accueil", () => {
  it("les mêmes clés dans les deux langues, aucune vide", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
    for (const [key, value] of [...Object.entries(fr), ...Object.entries(en)]) expect(value.trim(), key).not.toBe("");
  });

  it("une espace insécable devant les deux-points, jamais une espace ordinaire", () => {
    for (const value of Object.values(fr)) expect(value).not.toMatch(/ [:;?!]/);
  });

  it("le titre choisi se dit par sa variable", () => {
    expect(fr.heroFixedCurrent).toContain("{{title}}");
    expect(en.heroFixedCurrent).toContain("{{title}}");
  });
});
