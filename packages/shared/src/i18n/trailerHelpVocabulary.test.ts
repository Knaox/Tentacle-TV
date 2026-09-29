import { describe, expect, it } from "vitest";
import frTrailerHelp from "./locales/fr/trailerHelp";
import enTrailerHelp from "./locales/en/trailerHelp";

/**
 * L'espace `trailerHelp` est lu par le guide du MOBILE et par le rappel de sa
 * fiche : même garde-fou que `offline` et `stats` — le mot « téléchargement »
 * y est refusé dans les deux langues —, les deux langues portent les mêmes
 * clés, et aucune n'est vide (un texte vide laisserait un trou dans le guide).
 */
const FORBIDDEN = /t[ée]l[ée]charg|download/i;

describe("vocabulaire de l'espace trailerHelp", () => {
  for (const [lang, table] of [["fr", frTrailerHelp], ["en", enTrailerHelp]] as const) {
    it(`${lang} : aucune valeur ne contient le mot interdit`, () => {
      const offenders = Object.entries(table).filter(([, value]) => FORBIDDEN.test(value));
      expect(offenders).toEqual([]);
    });

    it(`${lang} : aucune valeur vide`, () => {
      const empty = Object.entries(table).filter(([, value]) => value.trim() === "");
      expect(empty).toEqual([]);
    });
  }

  it("les deux langues portent les mêmes clés", () => {
    expect(Object.keys(enTrailerHelp).sort()).toEqual(Object.keys(frTrailerHelp).sort());
  });

  it("le français ne coupe jamais une ligne devant « ? » ou « : »", () => {
    // Une espace ordinaire devant la ponctuation haute laisserait le « ? »
    // du rappel seul en début de ligne sur un téléphone.
    const breakable = Object.entries(frTrailerHelp).filter(([, value]) => / [?:!]/.test(value));
    expect(breakable).toEqual([]);
  });
});
