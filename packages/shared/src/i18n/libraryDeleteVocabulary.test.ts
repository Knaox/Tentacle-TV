import { describe, expect, it } from "vitest";
import fr from "./locales/fr/libraryDelete";
import en from "./locales/en/libraryDelete";
import frIndex from "./locales/fr";
import enIndex from "./locales/en";

/** Les clés d'un arbre de traductions, à plat (`types.Movie`…). */
function keysOf(table: object, prefix = ""): string[] {
  return Object.entries(table).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : keysOf(value as object, `${prefix}${key}.`),
  );
}

function valueAt(table: object, key: string): string {
  return key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], table) as string;
}

function variablesOf(text: string): string[] {
  return [...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1] ?? "").sort();
}

describe("espace libraryDelete (supprimer des titres, web et bureau)", () => {
  it("les deux langues portent les mêmes clés, enregistrées des deux côtés", () => {
    expect(keysOf(en).sort()).toEqual(keysOf(fr).sort());
    expect(frIndex.libraryDelete).toBe(fr);
    expect(enIndex.libraryDelete).toBe(en);
  });

  it("aucune chaîne vide, et les variables survivent à la traduction", () => {
    for (const key of keysOf(en)) {
      expect(valueAt(en, key).trim()).not.toBe("");
      expect(valueAt(fr, key).trim()).not.toBe("");
      expect(variablesOf(valueAt(en, key))).toEqual(variablesOf(valueAt(fr, key)));
    }
  });

  it("la confirmation dit le disque et l'irréversible, sans jargon", () => {
    expect(fr.diskWarning).toMatch(/disque du serveur/);
    expect(fr.diskWarning).toMatch(/irréversible/);
    expect(fr.forbidden_other).toMatch(/n'ont pas pu être supprimés/);
  });
});
