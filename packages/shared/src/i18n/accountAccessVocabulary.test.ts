import { describe, expect, it } from "vitest";
import { ACCESS_DAY_ORDER, ACCOUNT_CONNECT_REFUSALS } from "../index";
import fr from "./locales/fr/accountAccess";
import en from "./locales/en/accountAccess";

/** La page d'accès et les connexions refusées : mêmes clés et mêmes variables dans les deux langues. */

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

describe("accountAccess — vocabulaire", () => {
  const FR = flatten(fr as unknown as Tree);
  const EN = flatten(en as unknown as Tree);

  it("les deux langues ont exactement les mêmes clés et les mêmes variables", () => {
    expect(Object.keys(EN).sort()).toEqual(Object.keys(FR).sort());
    for (const key of Object.keys(FR)) expect(placeholders(EN[key]), key).toEqual(placeholders(FR[key]));
  });

  it("chaque jour du contrat et chaque refus de connexion a ses mots", () => {
    for (const day of ACCESS_DAY_ORDER) expect(FR[`days.${day}`], day).toBeTruthy();
    for (const code of ACCOUNT_CONNECT_REFUSALS) {
      expect(FR[`refusals.${code}`] ?? FR[`refusals.${code}_other`], code).toBeTruthy();
    }
  });
});
