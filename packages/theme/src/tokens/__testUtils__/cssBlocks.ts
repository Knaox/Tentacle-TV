/**
 * Lecture des feuilles CSS webOS pour les tests de garde.
 *
 * Trois tests recroisent les jetons partagés contre les feuilles de la LG
 * (`tv.test.ts`, `tvOnly.banner.test.ts`, `tvOnly.player.test.ts`) ; ils
 * partagent ces quelques outils au lieu de les recopier. On compare des PAIRES
 * (propriété, valeur) normalisées, jamais des octets : commentaires,
 * indentation et retours à la ligne n'ont aucun effet sur le rendu.
 */

import { readFileSync } from "node:fs";

/** Retire les commentaires, qui peuvent contenir des `{`, `}` ou `:`. */
export const stripComments = (css: string): string =>
  css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Une feuille prête à analyser : lue puis débarrassée de ses commentaires. */
export const readSheet = (absolutePath: string): string =>
  stripComments(readFileSync(absolutePath, "utf8"));

/** Normalise une valeur CSS sur ce qui compte pour le rendu : un espace en
 *  vaut un, et ceux qui collent aux parenthèses ou entourent une virgule
 *  n'existent pas pour l'analyseur. */
export const normalise = (value: string): string =>
  value
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s*,\s*/g, ", ")
    .trim();

/** Tous les blocs de premier niveau dont la liste de sélecteurs se termine par
 *  `selector` — une même cible peut être servie par plusieurs règles. */
export const blocksFor = (css: string, selector: string): string[] => {
  const out: string[] = [];
  const needle = `${selector} {`;
  let start = css.indexOf(needle);
  while (start !== -1) {
    const from = css.indexOf("{", start);
    let depth = 0;
    for (let i = from; i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}" && --depth === 0) {
        out.push(css.slice(from + 1, i));
        start = css.indexOf(needle, i);
        break;
      }
    }
    if (depth !== 0) throw new Error(`Bloc non refermé : ${selector}`);
  }
  return out;
};

/** Le premier bloc pour ce sélecteur — erreur s'il n'existe pas. */
export const blockFor = (css: string, selector: string): string => {
  const blocks = blocksFor(css, selector);
  if (blocks.length === 0) throw new Error(`Bloc introuvable : ${selector}`);
  return blocks[0];
};

/** Parmi les blocs d'un sélecteur, celui qui déclare cette propriété — pour
 *  les cibles servies par plusieurs règles (un bloc partagé, un bloc propre). */
export const blockWithProp = (
  css: string,
  selector: string,
  property: string,
): string => {
  const found = blocksFor(css, selector).find(
    (block) => propIn(block, property) !== null,
  );
  if (!found) {
    throw new Error(`Aucun bloc ${selector} ne déclare ${property}`);
  }
  return found;
};

/** Les variables CSS (`--x`) d'un bloc, valeurs normalisées. */
export const declarationsIn = (block: string): Map<string, string> => {
  const out = new Map<string, string>();
  for (const match of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    out.set(match[1], normalise(match[2]));
  }
  return out;
};

/** La valeur d'une propriété ORDINAIRE d'un bloc, normalisée — `null` si le
 *  bloc ne la déclare pas. Le nom est ancré pour que `background` ne happe pas
 *  `background-image`. */
export const propIn = (block: string, property: string): string | null => {
  const escaped = property.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
  const match = new RegExp(`(?:^|[;{\\s])${escaped}\\s*:\\s*([^;]+);`).exec(
    block,
  );
  return match ? normalise(match[1]) : null;
};

/** La première valeur d'une variable CSS dans toute la feuille — erreur si
 *  absente. Dans une feuille à deux thèmes, la première occurrence est celle
 *  du thème sombre, le seul que la dalle emploie. */
export const cssVarValue = (css: string, name: string): string => {
  const match = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(css);
  if (!match) throw new Error(`Variable absente : ${name}`);
  return normalise(match[1]);
};
