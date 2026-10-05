import { describe, expect, it } from "vitest";
import frRemoteAccess from "./locales/fr/remoteAccess";
import enRemoteAccess from "./locales/en/remoteAccess";
import frRemoteAccessHelp from "./locales/fr/remoteAccessHelp";
import enRemoteAccessHelp from "./locales/en/remoteAccessHelp";

/**
 * Les espaces `remoteAccess` et `remoteAccessHelp` : mêmes clés dans les deux
 * langues, aucune valeur vide, et le français ne coupe jamais une ligne devant
 * « ? », « : » ou « ! », ni à l'intérieur de ses guillemets (lus aussi sur un
 * téléphone, dans l'administration en miroir et dans l'assistant).
 */
const PAIRS = [
  ["remoteAccess", frRemoteAccess, enRemoteAccess],
  ["remoteAccessHelp", frRemoteAccessHelp, enRemoteAccessHelp],
] as const;

describe("vocabulaire de l'accès à distance", () => {
  for (const [name, fr, en] of PAIRS) {
    it(`${name} : les deux langues portent les mêmes clés`, () => {
      expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
    });

    it(`${name} : aucune valeur vide`, () => {
      const empty = [...Object.entries(fr), ...Object.entries(en)].filter(([, value]) => value.trim() === "");
      expect(empty).toEqual([]);
    });

    it(`${name} : le français ne coupe pas devant sa ponctuation haute`, () => {
      const breakable = Object.entries(fr).filter(([, value]) => / [?:!»]|« /.test(value));
      expect(breakable).toEqual([]);
    });
  }

  it("chaque verdict, cause et état du modèle a ses mots", () => {
    const keys = Object.keys(frRemoteAccess);
    for (const prefix of ["state_secure", "verdict_not_testable", "cause_http_port_closed", "outcome_nothing_to_check", "wan_double_nat"]) {
      expect(keys).toContain(prefix);
    }
  });
});
