import { describe, expect, it } from "vitest";
import frStats from "./locales/fr/stats";
import enStats from "./locales/en/stats";
import frStatsShare from "./locales/fr/statsShare";
import enStatsShare from "./locales/en/statsShare";
import frStatsPublic from "./locales/fr/statsPublic";
import enStatsPublic from "./locales/en/statsPublic";

/**
 * Les espaces des statistiques sont lus par le MOBILE (`stats`, et le panneau
 * de partage `statsShare`) ou par le miroir téléphone (`statsPublic`, la page
 * publique) : même garde-fou que l'espace `offline` — le mot
 * « téléchargement » y est refusé dans les deux langues —, et les deux
 * langues portent les mêmes clés.
 */
const FORBIDDEN = /t[ée]l[ée]charg|download/i;

const SPACES = [
  ["stats", frStats, enStats],
  ["statsShare", frStatsShare, enStatsShare],
  ["statsPublic", frStatsPublic, enStatsPublic],
] as const;

describe.each(SPACES)("vocabulaire de l'espace %s", (_name, fr, en) => {
  for (const [lang, table] of [["fr", fr], ["en", en]] as const) {
    it(`${lang} : aucune valeur ne contient le mot interdit`, () => {
      const offenders = Object.entries(table).filter(([, value]) => FORBIDDEN.test(value));
      expect(offenders).toEqual([]);
    });
  }

  it("les deux langues portent les mêmes clés", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });
});

describe("la page publique parle à la troisième personne", () => {
  it("ne remplace que des clés qui existent dans la page du propriétaire, ou les siennes", () => {
    const own = /^(periodNote_|updated|readOnlyNote|footer|backToStats|moment|aboutMoments)/;
    const orphans = Object.keys(frStatsPublic).filter((key) => !own.test(key) && !(key in frStats));
    expect(orphans).toEqual([]);
  });

  it("ne tutoie ni ne vouvoie le visiteur, et n'accorde jamais au genre", () => {
    const secondPerson = /\b(vous|votre|vos)\b/i;
    const gendered = /\b(il|elle)\b/i;
    for (const [key, value] of Object.entries(frStatsPublic)) {
      expect(value, key).not.toMatch(secondPerson);
      expect(value, key).not.toMatch(gendered);
    }
    for (const [key, value] of Object.entries(enStatsPublic)) {
      expect(value, key).not.toMatch(/\b(you|your|he|she|his|her)\b/i);
    }
  });
});
