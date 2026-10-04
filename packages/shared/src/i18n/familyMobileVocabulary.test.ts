import { describe, expect, it } from "vitest";
import frMobile from "./locales/fr/familyMobile";
import enMobile from "./locales/en/familyMobile";
import frWeb from "./locales/fr/familyWeb";
import enWeb from "./locales/en/familyWeb";
import frFamily from "./locales/fr/family";
import enFamily from "./locales/en/family";

/**
 * Le mobile lit trois espaces de la Famille : `family` (commun), `familyWeb`
 * (la page et l'affiche) et `familyMobile` (ses mots à lui). Aucun ne dit
 * « téléchargement » — les relecteurs d'Apple ouvrent ces écrans (CLAUDE.md) —,
 * et `familyMobile` a les mêmes clés et variables dans les deux langues.
 */

const FORBIDDEN = /t[ée]l[ée]charg|download/i;

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === "string") out[`${prefix}${key}`] = value;
    else Object.assign(out, flatten(value, `${prefix}${key}.`));
  }
  return out;
}

const placeholders = (text: string): string[] => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

describe("familyMobile — vocabulaire", () => {
  const FR = flatten(frMobile as unknown as Tree);
  const EN = flatten(enMobile as unknown as Tree);

  it("les deux langues ont exactement les mêmes clés et les mêmes variables", () => {
    expect(Object.keys(EN).sort()).toEqual(Object.keys(FR).sort());
    for (const key of Object.keys(FR)) expect(placeholders(EN[key]), key).toEqual(placeholders(FR[key]));
  });

  it("aucun espace lu par le mobile ne dit « téléchargement »", () => {
    for (const tree of [frMobile, enMobile, frWeb, enWeb, frFamily, enFamily]) {
      for (const [key, text] of Object.entries(flatten(tree as unknown as Tree))) {
        expect(text, key).not.toMatch(FORBIDDEN);
      }
    }
  });
});
