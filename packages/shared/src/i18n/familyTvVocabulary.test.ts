import { describe, expect, it } from "vitest";
import fr from "./locales/fr/familyTv";
import en from "./locales/en/familyTv";
import { FAMILY_PROFILE_COLORS } from "../family/familyContract";

/** Les clés d'un arbre de traductions, à plat (`pin.title`…). */
function keysOf(table: object, prefix = ""): string[] {
  return Object.entries(table).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : keysOf(value as object, `${prefix}${key}.`),
  );
}

describe("espace familyTv (la Famille sur l'Apple TV)", () => {
  it("les deux langues portent les mêmes clés", () => {
    expect(keysOf(en).sort()).toEqual(keysOf(fr).sort());
  });

  it("chaque couleur du contrat a son nom, dans les deux langues", () => {
    for (const color of FAMILY_PROFILE_COLORS) {
      expect(fr.colors[color]).toBeTruthy();
      expect(en.colors[color]).toBeTruthy();
    }
  });
});
