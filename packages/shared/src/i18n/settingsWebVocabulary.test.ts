import { describe, expect, it } from "vitest";
import fr from "./locales/fr/settingsWeb";
import en from "./locales/en/settingsWeb";
import frIndex from "./locales/fr";
import enIndex from "./locales/en";
import { WIDE_SETTINGS_SECTIONS } from "../settingsCatalog";

/** Les clés d'un arbre de traductions, à plat (`pin.title`…). */
function keysOf(table: object, prefix = ""): string[] {
  return Object.entries(table).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : keysOf(value as object, `${prefix}${key}.`),
  );
}

describe("espace settingsWeb (les réglages du web large et du bureau)", () => {
  it("les deux langues portent les mêmes clés", () => {
    expect(keysOf(en).sort()).toEqual(keysOf(fr).sort());
  });

  it("est enregistré dans les deux langues", () => {
    expect(frIndex.settingsWeb).toBe(fr);
    expect(enIndex.settingsWeb).toBe(en);
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

  it("chaque texte du catalogue du web large existe dans les deux langues", () => {
    const refs = WIDE_SETTINGS_SECTIONS.flatMap((section) => [
      section.label, section.intro,
      ...section.groups.flatMap((group) => [group.title, ...group.entries.flatMap((e) => [e.label, e.description, ...(e.keywords ? [e.keywords] : [])])]),
    ]);
    const frKeys = new Set(keysOf(fr));
    for (const ref of refs) {
      expect(ref.ns).toBe("settingsWeb");
      expect(frKeys.has(ref.key), ref.key).toBe(true);
    }
    for (const rail of ["watch", "interface", "you"]) expect(frKeys.has(`rail.${rail}`)).toBe(true);
  });
});

function valueAt(table: object, key: string): string {
  return key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], table) as string;
}

function variablesOf(text: string): string[] {
  return [...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1] ?? "").sort();
}
