import { describe, expect, it } from "vitest";
import fr from "./locales/fr/parentalTv";
import en from "./locales/en/parentalTv";

/** Les clés d'un arbre de traductions, à plat (`age.title`…). */
function keysOf(table: object, prefix = ""): string[] {
  return Object.entries(table).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : keysOf(value as object, `${prefix}${key}.`),
  );
}

describe("espace parentalTv (le contrôle parental simplifié de la TV)", () => {
  it("les deux langues portent les mêmes clés", () => {
    expect(keysOf(en).sort()).toEqual(keysOf(fr).sort());
  });

  it("la TV renvoie au bureau ou au web pour le reste, dans les deux langues", () => {
    expect(fr.more.title).toMatch(/bureau ou le web/);
    expect(en.more.title).toMatch(/desktop app or the web/);
  });
});
