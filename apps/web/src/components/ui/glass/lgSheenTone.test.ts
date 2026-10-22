/**
 * Le reflet des surfaces tonées (`lgLegibility.css`) : sur un dessous sombre,
 * elles reprennent le reflet du thème SOMBRE. La valeur y est recopiée (un
 * thème ne peut pas lire la valeur de l'autre) : ce test tient l'égalité, et
 * la recomposition locale identique à celle de la racine (`lgRecipes.css`).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const LEGIBILITY = readFileSync(join(__dirname, "lgLegibility.css"), "utf8");
const RECIPES = readFileSync(join(__dirname, "lgRecipes.css"), "utf8");
const TOKENS = readFileSync(join(__dirname, "../../../theme/liquidGlassTokens.css"), "utf8");

const declaration = (source: string, name: string): string[] =>
  // Ancrée en début de ligne : un commentaire qui cite la variable ne compte pas.
  [...source.matchAll(new RegExp(`^\\s*${name}:\\s*([^;]+);`, "gm"))].map((m) => m[1].trim());

describe("le reflet des surfaces tonées", () => {
  it("reprend le reflet du thème sombre (la PREMIÈRE déclaration des jetons)", () => {
    const [darkHighlight] = declaration(TOKENS, "--lg-highlight");
    expect(declaration(LEGIBILITY, "--lg-highlight")).toEqual([darkHighlight]);
  });

  it("recompose le reflet et le verre épais comme la racine", () => {
    expect(declaration(LEGIBILITY, "--lgc-sheen")).toEqual(declaration(RECIPES, "--lgc-sheen"));
    expect(declaration(LEGIBILITY, "--lgc-fill-thick")).toEqual(declaration(RECIPES, "--lgc-fill-thick"));
  });

  it("ne vaut jamais sous « Réduire la transparence »", () => {
    expect(LEGIBILITY).toContain(':root[data-liquid-glass="native"]:not([data-lg-material]) :is(.lg-menu, .lg-sheet, .lg-toast, .lg-notice)[data-lg-tone="dark"] {\n  --lg-highlight');
  });
});
