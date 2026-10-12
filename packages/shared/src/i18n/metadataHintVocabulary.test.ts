import { describe, expect, it } from "vitest";
import frMetadataHint from "./locales/fr/metadataHint";
import enMetadataHint from "./locales/en/metadataHint";
import { LIBRARY_RESCAN_ERRORS } from "../library/libraryRescanContract";

/**
 * L'espace `metadataHint` est lu par le mobile : le mot « téléchargement » y
 * est refusé dans les deux langues. Les deux langues portent les mêmes clés,
 * aucune n'est vide, et chaque refus du contrat de « Réanalyser maintenant »
 * a sa phrase.
 */
const FORBIDDEN = /t[ée]l[ée]charg|download/i;

describe("vocabulaire de l'espace metadataHint", () => {
  for (const [lang, table] of [["fr", frMetadataHint], ["en", enMetadataHint]] as const) {
    it(`${lang} : aucune valeur ne contient le mot interdit, aucune n'est vide`, () => {
      expect(Object.entries(table).filter(([, value]) => FORBIDDEN.test(value))).toEqual([]);
      expect(Object.entries(table).filter(([, value]) => value.trim() === "")).toEqual([]);
    });

    it(`${lang} : chaque refus du serveur se dit`, () => {
      for (const code of LIBRARY_RESCAN_ERRORS) expect(table).toHaveProperty(`rescanError_${code}`);
    });
  }

  it("les deux langues portent les mêmes clés", () => {
    expect(Object.keys(enMetadataHint).sort()).toEqual(Object.keys(frMetadataHint).sort());
  });

  it("le français ne coupe jamais une ligne devant « ? », « : » ou « ! »", () => {
    expect(Object.entries(frMetadataHint).filter(([, value]) => / [?:!]/.test(value))).toEqual([]);
  });
});
