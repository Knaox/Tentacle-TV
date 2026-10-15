import { describe, expect, it } from "vitest";
import fr from "./locales/fr/userRights";
import en from "./locales/en/userRights";

/**
 * L'espace `userRights` (fiche des droits de l'administration, contrôle
 * parental de la Famille) : mêmes clés et mêmes variables dans les deux
 * langues, un libellé et une ligne d'explication pour chaque réglage.
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

describe("userRights — vocabulaire", () => {
  it("chaque réglage a son libellé et son explication", () => {
    for (const field of Object.keys(fr.fields)) {
      expect(FR[`fields.${field}.label`], field).toBeTruthy();
      expect(FR[`fields.${field}.hint`], field).toBeTruthy();
    }
  });

  it("chaque type non classé de Jellyfin a son nom", () => {
    for (const type of ["Movie", "Trailer", "Series", "Music", "Book", "LiveTvChannel", "LiveTvProgram", "ChannelContent", "Other"]) {
      expect(FR[`parental.unrated.${type}`], type).toBeTruthy();
    }
  });

  it("les deux langues ont exactement les mêmes clés", () => {
    expect(Object.keys(EN).sort()).toEqual(Object.keys(FR).sort());
  });

  it("chaque phrase garde ses variables d'une langue à l'autre", () => {
    for (const key of Object.keys(FR)) expect(placeholders(EN[key]), key).toEqual(placeholders(FR[key]));
  });

});
