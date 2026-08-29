/**
 * La preuve que la couche téléviseur n'a rien changé.
 *
 * `tokens-tv.css` était écrit à la main. Ses valeurs vivent désormais dans
 * `tokens/tv.ts` et `tokens/tvOnly.ts`, et la feuille est engendrée à partir
 * d'elles. Ce test compare les deux, déclaration par déclaration : si une seule
 * valeur avait bougé pendant l'extraction, la LG aurait changé d'apparence sans
 * que personne ne l'ait demandé — et personne n'a de LG sous la main pour s'en
 * apercevoir.
 *
 * Couplage volontaire (test uniquement) : `packages/theme` ne dépend pas de
 * `apps/tv-webos` au runtime, on lit juste le fichier pour comparer. Les
 * outils de lecture sont partagés avec les autres tests de garde —
 * `__testUtils__/cssBlocks.ts`.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { partialThemeToCssVarEntries } from "../css/toCssVariables";
import {
  blockFor,
  cssVarValue,
  declarationsIn,
  normalise,
  stripComments,
} from "./__testUtils__/cssBlocks";
import { TV_THEME_TOKEN_OVERRIDES, TV_THEME_TOKEN_OVERRIDES_LIGHT } from "./tv";
import { TV_FOCUS_RING, tvOnlyCssVarEntries } from "./tvOnly";

const HERE = dirname(fileURLToPath(import.meta.url));
const TOKENS_TV_CSS = resolve(
  HERE,
  "../../../../apps/tv-webos/client/src/styles/tokens-tv.css",
);

const withoutComments = stripComments(readFileSync(TOKENS_TV_CSS, "utf8"));

const asMap = (entries: Array<[string, string]>): Map<string, string> =>
  new Map(entries.map(([name, value]) => [name, normalise(value)]));

describe("la couche téléviseur reproduit tokens-tv.css", () => {
  const dark = declarationsIn(blockFor(withoutComments, ":root"));
  const light = declarationsIn(
    blockFor(withoutComments, ':root[data-theme="light"]'),
  );

  const generatedDark = asMap([
    ...partialThemeToCssVarEntries(TV_THEME_TOKEN_OVERRIDES),
    ...tvOnlyCssVarEntries(),
  ]);
  const generatedLight = asMap(
    partialThemeToCssVarEntries(TV_THEME_TOKEN_OVERRIDES_LIGHT),
  );

  it("déclare exactement les mêmes variables en sombre", () => {
    expect([...generatedDark.keys()].sort()).toEqual([...dark.keys()].sort());
  });

  it("donne exactement les mêmes valeurs en sombre", () => {
    for (const [name, expected] of dark) {
      expect(generatedDark.get(name), `valeur de ${name}`).toBe(expected);
    }
  });

  it("déclare exactement les mêmes variables en clair", () => {
    expect([...generatedLight.keys()].sort()).toEqual([...light.keys()].sort());
  });

  it("donne exactement les mêmes valeurs en clair", () => {
    for (const [name, expected] of light) {
      expect(generatedLight.get(name), `valeur de ${name}`).toBe(expected);
    }
  });
});

/**
 * L'anneau de focus, lui, n'est pas engendré : `focus.css` mêle ses variables à
 * des règles de sélecteur qu'un générateur n'aurait aucune raison de connaître.
 * Le garde-fou reste le même — si les deux définitions divergent, ce test le
 * dit avant que les téléviseurs ne cessent de se ressembler.
 */
describe("l'anneau de focus est le même des deux côtés", () => {
  const FOCUS_CSS = resolve(
    HERE,
    "../../../../apps/tv-webos/client/src/styles/focus.css",
  );
  const sheet = stripComments(readFileSync(FOCUS_CSS, "utf8"));
  const value = (nom: string): string => cssVarValue(sheet, nom);

  it("a la même épaisseur", () => {
    expect(value("--tv-anneau-epaisseur")).toBe(`${TV_FOCUS_RING.thickness}px`);
  });

  it("a la même teinte", () => {
    expect(value("--tv-anneau-teinte")).toBe(TV_FOCUS_RING.tint);
  });

  it("a le même halo", () => {
    expect(value("--tv-anneau-halo")).toBe(
      `rgba(var(--brand-rgb), ${TV_FOCUS_RING.haloOpacity})`,
    );
  });

  it("compose l'anneau avec les mêmes mesures", () => {
    expect(value("--tv-anneau")).toBe(
      `0 0 0 var(--tv-anneau-epaisseur) var(--tv-anneau-teinte), ` +
        `0 0 ${TV_FOCUS_RING.haloBlur}px ${TV_FOCUS_RING.haloSpread}px var(--tv-anneau-halo)`,
    );
  });

  it("relève une carte avec la même ombre", () => {
    expect(value("--tv-anneau-releve")).toBe(
      `var(--tv-anneau), 0 ${TV_FOCUS_RING.liftOffsetY}px ` +
        `${TV_FOCUS_RING.liftBlur}px -10px rgba(0, 0, 0, ${TV_FOCUS_RING.liftOpacity})`,
    );
  });
});
