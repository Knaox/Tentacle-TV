import { describe, expect, it } from "vitest";
import frRequests from "./locales/fr/requests";
import enRequests from "./locales/en/requests";
import { MY_TITLE_PERCENT_KEY, MY_TITLE_STATE_KEYS } from "../search/pluginTitlesMine";

/**
 * L'espace `requests` dit où en sont les titres demandés, sur les téléviseurs
 * (Apple TV d'abord) : même garde-fou que `offline` — les relecteurs d'Apple
 * lisent « téléchargement » comme une distribution de contenu hors boutique.
 */
const FORBIDDEN = /t[ée]l[ée]charg|download/i;

describe("vocabulaire de l'espace requests", () => {
  for (const [lang, table] of [["fr", frRequests], ["en", enRequests]] as const) {
    it(`${lang} : aucune valeur ne contient le mot interdit`, () => {
      const offenders = Object.entries(table).filter(([, value]) => FORBIDDEN.test(value));
      expect(offenders).toEqual([]);
    });

    it(`${lang} : chaque état du contrat a son mot`, () => {
      for (const key of [...Object.values(MY_TITLE_STATE_KEYS), MY_TITLE_PERCENT_KEY]) {
        const [ns, name] = key.split(":");
        expect(ns).toBe("requests");
        expect(table[name as keyof typeof table], key).toBeTruthy();
      }
    });
  }

  it("les deux langues portent les mêmes clés", () => {
    expect(Object.keys(enRequests).sort()).toEqual(Object.keys(frRequests).sort());
  });
});
