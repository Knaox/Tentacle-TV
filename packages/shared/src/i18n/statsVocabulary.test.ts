import { describe, expect, it } from "vitest";
import frStats from "./locales/fr/stats";
import enStats from "./locales/en/stats";

/**
 * L'espace `stats` est lu par la page de statistiques du MOBILE : même
 * garde-fou que l'espace `offline` — le mot « téléchargement » y est refusé
 * dans les deux langues —, et les deux langues portent les mêmes clés.
 */
const FORBIDDEN = /t[ée]l[ée]charg|download/i;

describe("vocabulaire de l'espace stats", () => {
  for (const [lang, table] of [["fr", frStats], ["en", enStats]] as const) {
    it(`${lang} : aucune valeur ne contient le mot interdit`, () => {
      const offenders = Object.entries(table).filter(([, value]) => FORBIDDEN.test(value));
      expect(offenders).toEqual([]);
    });
  }

  it("les deux langues portent les mêmes clés", () => {
    expect(Object.keys(enStats).sort()).toEqual(Object.keys(frStats).sort());
  });
});
