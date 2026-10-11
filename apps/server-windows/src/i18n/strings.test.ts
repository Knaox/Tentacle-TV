import { describe, expect, it } from "vitest";
import { STRINGS, format, languageFromLangId, type Strings } from "./strings";

const EMOJI = /\p{Extended_Pictographic}/u;

describe("textes de l'hôte", () => {
  it("ont les mêmes variables en français et en anglais", () => {
    const keys = Object.keys(STRINGS.fr) as (keyof Strings)[];
    for (const key of keys) {
      const vars = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? "").sort();
      expect(vars(STRINGS.en[key]), key).toEqual(vars(STRINGS.fr[key]));
    }
  });

  it("ne portent aucun emoji", () => {
    for (const table of Object.values(STRINGS)) {
      for (const text of Object.values(table)) expect(EMOJI.test(text), text).toBe(false);
    }
  });
});

describe("languageFromLangId", () => {
  it("prend le français pour toutes ses variantes, l'anglais sinon", () => {
    expect(languageFromLangId(0x040c)).toBe("fr");
    expect(languageFromLangId(0x0c0c)).toBe("fr");
    expect(languageFromLangId(0x0409)).toBe("en");
    expect(languageFromLangId(0x0407)).toBe("en");
  });
});

describe("format", () => {
  it("remplace les variables connues et laisse les autres", () => {
    expect(format("Port {port} et {x}", { port: 3000 })).toBe("Port 3000 et {x}");
  });
});
