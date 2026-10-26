import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WIDE_SETTINGS_SECTIONS } from "@tentacle-tv/shared";

/**
 * AUCUN RÉGLAGE PERDU, côté rendu : chaque ligne du catalogue du web large
 * est dessinée par une `SettingItem setting="<id>"` (libellé, portée,
 * explication, ancre), ou par un bloc qui porte son ancre
 * (`settingAnchor("<id>")` : la Famille, Octave). Une ligne ajoutée au
 * catalogue sans composant, ou un composant qui perd sa ligne, échoue ici.
 */

const SRC = join(__dirname, "../../..");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const code = [
  ...sources(join(SRC, "components/settings")),
  ...sources(join(SRC, "pages/settings")),
].map((path) => readFileSync(path, "utf8")).join("\n");

const ids = WIDE_SETTINGS_SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.entries.map((e) => e.id)));

describe("le web large dessine chaque réglage de son catalogue", () => {
  it.each(ids)("« %s » a sa ligne (ou son ancre)", (id) => {
    const drawn = code.includes(`setting="${id}"`) || code.includes(`settingAnchor("${id}")`);
    expect(drawn, `${id} : ni <SettingItem setting="${id}">, ni settingAnchor("${id}")`).toBe(true);
  });

  it("chaque groupe du catalogue est posé par sa page (WideGroup)", () => {
    // La Famille est l'écran partagé avec le miroir : ses sections portent leurs propres titres
    // (`familyWeb`) et leur ancre — les groupes du catalogue n'y servent qu'à la recherche.
    for (const section of WIDE_SETTINGS_SECTIONS.filter((s) => s.id !== "family")) {
      for (const group of section.groups) {
        expect(code, `${section.id}/${group.id}`).toContain(`section="${section.id}" group="${group.id}"`);
      }
    }
  });

  it("aucune ligne ne nomme un réglage absent du catalogue", () => {
    const known = new Set(ids);
    for (const match of code.matchAll(/setting="([A-Za-z]+)"|settingAnchor\("([A-Za-z]+)"\)/g)) {
      expect(known.has((match[1] ?? match[2]) as (typeof ids)[number]), match[0]).toBe(true);
    }
  });
});
