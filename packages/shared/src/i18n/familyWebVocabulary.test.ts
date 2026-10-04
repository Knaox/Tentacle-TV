import { describe, expect, it } from "vitest";
import fr from "./locales/fr/familyWeb";
import en from "./locales/en/familyWeb";
import { FAMILY_PROFILE_COLORS } from "../family/familyContract";

/**
 * L'espace `familyWeb` (page Famille du web et du bureau, affiche,
 * interrupteurs de l'administration) : mêmes clés et mêmes variables dans les
 * deux langues, un nom pour chaque couleur du contrat.
 */

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === "string") out[`${prefix}${key}`] = value;
    else Object.assign(out, flatten(value, `${prefix}${key}.`));
  }
  return out;
}

const FR = flatten(fr as unknown as Tree);
const EN = flatten(en as unknown as Tree);
const placeholders = (text: string): string[] => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

describe("familyWeb — vocabulaire", () => {
  it("les deux langues ont exactement les mêmes clés", () => {
    expect(Object.keys(EN).sort()).toEqual(Object.keys(FR).sort());
  });

  it("chaque phrase garde ses variables d'une langue à l'autre", () => {
    for (const key of Object.keys(FR)) expect(placeholders(EN[key]), key).toEqual(placeholders(FR[key]));
  });

  it("chaque couleur de profil du contrat a son nom", () => {
    for (const color of FAMILY_PROFILE_COLORS) {
      expect(FR[`guest.colors.${color}`], color).toBeTruthy();
      expect(EN[`guest.colors.${color}`], color).toBeTruthy();
    }
  });
});
