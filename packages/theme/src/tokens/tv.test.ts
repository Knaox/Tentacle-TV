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
 * On compare les PAIRES (nom, valeur), pas les octets du fichier : les
 * commentaires et l'indentation n'ont aucun effet sur le rendu, seules les
 * déclarations en ont. Les espaces internes d'une valeur sont normalisés, pour
 * la même raison — `linear-gradient(\n  72deg,` et `linear-gradient(72deg,`
 * produisent le même dégradé.
 *
 * Couplage volontaire (test uniquement) : `packages/theme` ne dépend pas de
 * `apps/tv-webos` au runtime, on lit juste le fichier pour comparer.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { partialThemeToCssVarEntries } from "../css/toCssVariables";
import { TV_THEME_TOKEN_OVERRIDES, TV_THEME_TOKEN_OVERRIDES_LIGHT } from "./tv";
import { tvOnlyCssVarEntries } from "./tvOnly";

const HERE = dirname(fileURLToPath(import.meta.url));
const TOKENS_TV_CSS = resolve(
  HERE,
  "../../../../apps/tv-webos/client/src/styles/tokens-tv.css",
);

const css = readFileSync(TOKENS_TV_CSS, "utf8");

/** Retire les commentaires, qui peuvent contenir des `{`, `}` ou `:`. */
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Découpe le fichier en blocs `sélecteur { … }` de premier niveau. */
const blockFor = (selector: string): string => {
  const start = withoutComments.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Bloc introuvable : ${selector}`);
  const from = withoutComments.indexOf("{", start);
  let depth = 0;
  for (let i = from; i < withoutComments.length; i++) {
    if (withoutComments[i] === "{") depth++;
    else if (withoutComments[i] === "}" && --depth === 0) {
      return withoutComments.slice(from + 1, i);
    }
  }
  throw new Error(`Bloc non refermé : ${selector}`);
};

/** Normalise une valeur CSS sur ce qui compte pour le rendu.
 *
 * Un espace, quel qu'il soit et si long soit-il, en vaut un seul ; et l'espace
 * qui suit une parenthèse ouvrante, précède une fermante ou entoure une virgule
 * n'existe pas pour l'analyseur CSS. Sans cette seconde règle, un dégradé écrit
 * sur plusieurs lignes serait déclaré différent du même dégradé écrit sur une
 * seule — ce qui ferait échouer le test sur de la mise en forme au lieu de
 * valeurs. */
const normalise = (value: string): string =>
  value
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s*,\s*/g, ", ")
    .trim();

/** Les déclarations d'un bloc, dans l'ordre, valeurs normalisées. */
const declarationsIn = (block: string): Map<string, string> => {
  const out = new Map<string, string>();
  // Une déclaration court jusqu'au `;` — la valeur peut tenir sur plusieurs
  // lignes et contenir des parenthèses (les dégradés en sont pleins).
  for (const match of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    out.set(match[1], normalise(match[2]));
  }
  return out;
};

const asMap = (entries: Array<[string, string]>): Map<string, string> =>
  new Map(entries.map(([name, value]) => [name, normalise(value)]));

describe("la couche téléviseur reproduit tokens-tv.css", () => {
  const dark = declarationsIn(blockFor(":root"));
  const light = declarationsIn(blockFor(':root[data-theme="light"]'));

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
