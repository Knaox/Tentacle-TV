import { describe, expect, it } from "vitest";
import frErrors from "./locales/fr/errors";
import enErrors from "./locales/en/errors";

/**
 * L'espace `errors` porte les messages d'erreur de TOUTES les plateformes,
 * mobile compris : les relecteurs d'Apple y liraient « téléchargement » comme
 * une distribution de contenu hors boutique. Le mot n'y entre pas, dans
 * aucune langue — « gardé hors ligne », « sur cet appareil » le remplacent.
 */
const FORBIDDEN = /t[ée]l[ée]charg|download/i;

describe("vocabulaire de l'espace errors", () => {
  for (const [lang, table] of [["fr", frErrors], ["en", enErrors]] as const) {
    it(`${lang} : aucune valeur ne contient le mot interdit`, () => {
      const offenders = Object.entries(table).filter(([, value]) => FORBIDDEN.test(value));
      expect(offenders).toEqual([]);
    });
  }
});
