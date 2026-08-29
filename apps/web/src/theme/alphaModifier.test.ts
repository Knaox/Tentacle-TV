/**
 * Le garde-fou d'un défaut QUI NE SE VOIT PAS.
 *
 * Les couleurs du thème sont servies à Tailwind sous la forme `var(--jeton)`,
 * sans le marqueur `<alpha-value>`. Tailwind 3 ne sait alors pas y composer une
 * opacité : il SUPPRIME la déclaration entière, sans un avertissement, sans
 * échec de compilation. `text-cta-primary-fg/70` ne produit donc aucune couleur
 * — l'élément hérite de celle de son parent.
 *
 * Le coût s'est mesuré en vrai : une croix blanche sur une pilule blanche,
 * invisible au repos et révélée au survol par le seul `hover:` sans
 * modificateur, qui, lui, compile. Un audit du CSS produit en a trouvé douze
 * autres, dont le fond de sélection du menu de vitesse et celui de la ligne
 * d'épisode — tous absents depuis on ne sait quand.
 *
 * La parade tient en une règle : sur un jeton `var()`, on écrit la couleur en
 * clair. `rgba(var(--brand-rgb), 0.25)` quand la variable `-rgb` existe (voir
 * `tokens.css`), une valeur littérale sinon quand la surface est la même dans
 * les deux thèmes. Surtout PAS `color-mix()` : les dalles de téléviseur
 * d'avant Chrome 111 ne le connaissent pas, et le dépôt porte déjà un repli
 * pour cette raison (`--brand-mid`).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { tentacleTailwindPreset } from "@tentacle-tv/theme/tailwind";

/** Les préfixes d'utilitaires COULEUR qui acceptent un modificateur d'opacité. */
const COLOR_PREFIXES = [
  "text", "bg", "border", "ring", "ring-offset", "divide", "from", "via", "to",
  "fill", "stroke", "decoration", "outline", "accent", "caret", "placeholder", "shadow",
] as const;

/** Les racines scannées — exactement le `content` de `tailwind.config.ts`. */
const ROOTS = ["../..", "../../../../packages/ui/src"].map((r) =>
  fileURLToPath(new URL(r, import.meta.url)),
);

type ColorTree = Record<string, unknown>;

/** Aplatit l'arbre des couleurs en noms d'utilitaires (`cta-primary-fg`…). */
function flattenColors(tree: ColorTree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const name = key === "DEFAULT" ? prefix : prefix ? `${prefix}-${key}` : key;
    if (typeof value === "string") out.set(name, value);
    else if (value && typeof value === "object") {
      for (const [k, v] of flattenColors(value as ColorTree, name)) out.set(k, v);
    }
  }
  return out;
}

/** Un jeton dont Tailwind ne peut PAS composer l'opacité. */
const isOpaqueOnly = (value: string): boolean =>
  value.trimStart().startsWith("var(") && !value.includes("<alpha-value>");

/** Le code seul : les commentaires expliquent souvent le piège, en le citant. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|\s)\/\/[^\n]*/g, " ");
}

function sourceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === "dist") continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if ([".ts", ".tsx"].includes(extname(full))) out.push(full);
    }
  };
  walk(root);
  return out;
}

describe("les jetons de couleur et le modificateur d'opacité de Tailwind", () => {
  const colors = flattenColors(
    (tentacleTailwindPreset.theme?.extend?.colors ?? {}) as ColorTree,
  );
  const fragile = [...colors].filter(([, v]) => isOpaqueOnly(v)).map(([name]) => name);

  it("le préset en sert bien sous forme `var()` — sinon ce banc n'a plus d'objet", () => {
    expect(fragile.length).toBeGreaterThan(0);
  });

  it("aucun de ces jetons ne porte de modificateur d'opacité dans le code", () => {
    const pattern = new RegExp(
      `\\b(?:${COLOR_PREFIXES.join("|")})-(${fragile.join("|")})\\/\\d{1,3}\\b`,
      "g",
    );
    const offenders: string[] = [];
    for (const root of ROOTS) {
      for (const file of sourceFiles(root)) {
        if (file.endsWith("alphaModifier.test.ts")) continue;
        for (const m of stripComments(readFileSync(file, "utf8")).matchAll(pattern)) {
          offenders.push(`${file.split("/src/")[1] ?? file} → ${m[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
