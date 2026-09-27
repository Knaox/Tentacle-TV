import { describe, expect, it } from "vitest";
import frOffline from "./locales/fr/offline";
import enOffline from "./locales/en/offline";

/**
 * L'espace `offline` est la source des textes du hors ligne MOBILE : les
 * relecteurs d'Apple y lisent « téléchargement » comme une distribution de
 * contenu hors boutique. Ce garde-fou refuse le mot dans les deux langues.
 */
const FORBIDDEN = /t[ée]l[ée]charg|download/i;

describe("vocabulaire de l'espace offline", () => {
  for (const [lang, table] of [["fr", frOffline], ["en", enOffline]] as const) {
    it(`${lang} : aucune valeur ne contient le mot interdit`, () => {
      const offenders = Object.entries(table).filter(([, value]) => FORBIDDEN.test(value));
      expect(offenders).toEqual([]);
    });
  }

  it("les deux langues portent les mêmes clés", () => {
    expect(Object.keys(enOffline).sort()).toEqual(Object.keys(frOffline).sort());
  });
});
