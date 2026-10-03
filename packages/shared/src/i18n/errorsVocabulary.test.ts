import { describe, expect, it } from "vitest";
import frErrors from "./locales/fr/errors";
import enErrors from "./locales/en/errors";
import frNotices from "./locales/fr/notices";
import enNotices from "./locales/en/notices";

/**
 * Les espaces `errors` et `notices` portent les messages d'erreur et les
 * avertissements de TOUTES les plateformes, mobile compris : les relecteurs
 * d'Apple y liraient « téléchargement » comme une distribution de contenu
 * hors boutique. Le mot n'y entre pas, dans aucune langue — « gardé hors
 * ligne », « sur cet appareil » le remplacent.
 */
const FORBIDDEN = /t[ée]l[ée]charg|download/i;

describe("vocabulaire des espaces errors et notices", () => {
  const tables = [["errors fr", frErrors], ["errors en", enErrors], ["notices fr", frNotices], ["notices en", enNotices]] as const;
  for (const [name, table] of tables) {
    it(`${name} : aucune valeur ne contient le mot interdit`, () => {
      const offenders = Object.entries(table).filter(([, value]) => FORBIDDEN.test(value));
      expect(offenders).toEqual([]);
    });
  }

  it("notices : les deux langues portent les mêmes clés", () => {
    expect(Object.keys(enNotices).sort()).toEqual(Object.keys(frNotices).sort());
  });
});
