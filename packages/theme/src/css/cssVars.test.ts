/**
 * Garde-fou anti-dérive entre `CSS_VAR_NAMES` et le fichier statique
 * `apps/web/src/theme/tokens.css`.
 *
 * Les deux sources décrivent le même contrat mais vivent dans des packages
 * différents, et rien ne les reliait : les `--fill-*` avaient ainsi dérivé
 * pendant des mois — déclarés dans `tokens.css`, absents de `CSS_VAR_NAMES`,
 * donc jamais émis par le générateur NI surchargeables depuis l'éditeur admin.
 * Un token invisible pour l'admin est un token à moitié mort.
 *
 * Couplage volontaire (test uniquement) : `packages/theme` ne dépend pas de
 * `apps/web` au runtime, on lit juste le fichier pour comparer les deux listes.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CSS_VAR_NAMES } from "./varNames";

const HERE = dirname(fileURLToPath(import.meta.url));
const TOKENS_CSS = resolve(HERE, "../../../../apps/web/src/theme/tokens.css");

const css = readFileSync(TOKENS_CSS, "utf8");

/** Découpe le fichier en blocs `sélecteur { … }` de premier niveau. */
const blockFor = (selector: string): string => {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Bloc introuvable dans tokens.css : ${selector}`);
  const from = css.indexOf("{", start);
  let depth = 0;
  for (let i = from; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(from + 1, i);
  }
  throw new Error(`Bloc non refermé : ${selector}`);
};

const declaredIn = (block: string): Set<string> =>
  new Set(Array.from(block.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim), (m) => m[1]));

/** Aplatit CSS_VAR_NAMES en la liste des noms de variables attendus. */
const flatten = (node: unknown, out: string[] = []): string[] => {
  if (typeof node === "string") out.push(node);
  else if (node && typeof node === "object") {
    for (const v of Object.values(node)) flatten(v, out);
  }
  return out;
};

const EXPECTED = flatten(CSS_VAR_NAMES);
const ROOT = declaredIn(blockFor(":root"));
const LIGHT = declaredIn(blockFor(':root[data-theme="light"]'));

/** Noms de variables colorimétriques uniquement (le clair ne touche pas au reste). */
const COLOR_VARS = flatten(CSS_VAR_NAMES.color);

/**
 * Tokens couleur DÉLIBÉRÉMENT non redéclarés en clair. Toute autre omission
 * est une erreur : elle laisserait une valeur sombre fuiter en thème clair.
 */
const CONSTANTS_ACROSS_SCHEMES = [
  // Le texte sur affiche reste blanc + voile sombre dans les deux schémas :
  // la luminosité d'un poster ne dépend pas du thème choisi.
  "--on-media-primary",
  "--on-media-secondary",
  "--on-media-shadow",
  "--scrim-media-rgb",
  "--on-media-muted",
  // Texte sur aplat de marque : blanc dans les deux schémas, pour la même
  // raison — c'est le contraste avec l'accent qui commande, pas le thème.
  "--cta-brand-fg",
];

describe("tokens.css ↔ CSS_VAR_NAMES", () => {
  it("chaque variable de CSS_VAR_NAMES est déclarée dans :root", () => {
    const manquantes = EXPECTED.filter((name) => !ROOT.has(name));
    expect(manquantes).toEqual([]);
  });

  it("le bloc clair ne déclare que des variables connues (pas de coquille)", () => {
    const inconnues = [...LIGHT].filter((name) => !EXPECTED.includes(name));
    expect(inconnues).toEqual([]);
  });

  it("chaque token couleur est redéclaré en clair, sauf les constantes documentées", () => {
    const manquantes = COLOR_VARS.filter(
      (name) => !LIGHT.has(name) && !CONSTANTS_ACROSS_SCHEMES.includes(name),
    );
    expect(manquantes).toEqual([]);
  });

  it("les constantes documentées ne sont effectivement PAS redéclarées en clair", () => {
    // Si l'une d'elles apparaît un jour dans le bloc clair, soit la décision a
    // changé (mettre à jour la liste), soit c'est un ajout involontaire.
    const redeclarees = CONSTANTS_ACROSS_SCHEMES.filter((name) => LIGHT.has(name));
    expect(redeclarees).toEqual([]);
  });
});
