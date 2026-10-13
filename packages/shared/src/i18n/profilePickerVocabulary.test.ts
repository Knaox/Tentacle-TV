import { describe, expect, it } from "vitest";
import fr from "./locales/fr/profilePicker";
import en from "./locales/en/profilePicker";
import frIndex from "./locales/fr";
import enIndex from "./locales/en";

/** Les clés d'un arbre de traductions, à plat (`pin.title`…). */
function keysOf(table: object, prefix = ""): string[] {
  return Object.entries(table).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : keysOf(value as object, `${prefix}${key}.`),
  );
}

describe("espace profilePicker (les profils sur le bureau)", () => {
  it("les deux langues portent les mêmes clés", () => {
    expect(keysOf(en).sort()).toEqual(keysOf(fr).sort());
  });

  it("est enregistré dans les deux langues", () => {
    expect(frIndex.profilePicker).toBe(fr);
    expect(enIndex.profilePicker).toBe(en);
  });

  it("aucune chaîne vide, et les variables survivent à la traduction", () => {
    const frFlat = new Map(keysOf(fr).map((key) => [key, valueAt(fr, key)]));
    for (const key of keysOf(en)) {
      const english = valueAt(en, key);
      const french = frFlat.get(key) ?? "";
      expect(english.trim()).not.toBe("");
      expect(french.trim()).not.toBe("");
      expect(variablesOf(english)).toEqual(variablesOf(french));
    }
  });
});

function valueAt(table: object, key: string): string {
  return key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], table) as string;
}

function variablesOf(text: string): string[] {
  return [...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1] ?? "").sort();
}
