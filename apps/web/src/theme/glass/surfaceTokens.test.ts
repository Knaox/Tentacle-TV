/**
 * Les jetons du lot lg2 (`surfaceTokens.css`) : le CONTRAT des axes B, C et D.
 * Chacun existe en sombre ET en clair, tout est sous la porte du mode natif,
 * et les jetons qui vivent DANS un verre suivent son ton.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(join(__dirname, "surfaceTokens.css"), "utf8");
const GATE = ':root[data-liquid-glass="native"]';

/** Le corps d'un bloc de premier niveau `sélecteur { … }`. */
function blockFor(selector: string): string {
  const start = CSS.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Bloc introuvable : ${selector}`);
  return CSS.slice(CSS.indexOf("{", start) + 1, CSS.indexOf("}", start));
}

const declared = (block: string): Set<string> =>
  new Set(Array.from(block.matchAll(/^\s*(--lg-[a-z0-9-]+)\s*:/gim), (m) => m[1]));

/** Le contrat du brief, tel quel : les axes B, C, D le lisent. */
const CONTRACT = [
  "--lg-row-radius",
  "--lg-row-inset",
  "--lg-row-highlight",
  "--lg-row-highlight-glyph",
  "--lg-separator",
  "--lg-section-label",
  "--lg-sidebar-selection",
  "--lg-sidebar-selection-glyph",
  "--lg-surface-shadow",
  "--lg-content-fill",
  "--lg-content-fill-hover",
  "--lg-content-stroke",
  "--lg-scroll-edge",
] as const;

/** Ce qui porte une couleur : redit en clair. */
const COLORED = CONTRACT.filter((name) => !["--lg-row-radius", "--lg-row-inset", "--lg-row-highlight-glyph"].includes(name));

describe("le contrat du lot lg2", () => {
  it("chaque jeton du contrat est déclaré sous la porte", () => {
    const dark = declared(blockFor(GATE));
    for (const name of CONTRACT) expect(dark, name).toContain(name);
  });

  it("le clair redit tout ce qui porte une couleur, et rien d'inconnu", () => {
    const dark = declared(blockFor(GATE));
    const light = declared(blockFor(`${GATE}[data-theme="light"]`));
    for (const name of COLORED) expect(light, name).toContain(name);
    for (const name of light) expect(dark, name).toContain(name);
  });

  it("aucune règle hors de la porte : le rendu d'avant ne voit aucun de ces noms", () => {
    const selectors = Array.from(CSS.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{/g), (m) => m[1].trim());
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) expect(selector).toContain(GATE);
  });

  it("dans un verre, séparateur et intitulé suivent SON ton, pas le thème", () => {
    for (const tone of ["dark", "light"]) {
      const block = declared(blockFor(`${GATE} [data-lg-tone="${tone}"]`));
      expect(block).toContain("--lg-separator");
      expect(block).toContain("--lg-section-label");
    }
  });

  it("la rangée est concentrique : rayon = rayon de la surface − marge", () => {
    expect(blockFor(GATE)).toMatch(/--lg-row-radius:\s*calc\(var\(--lg-surface-radius\) - var\(--lg-row-inset\)\)/);
  });

  it("la sélection d'un menu est l'accent UNI (jamais le dégradé de la marque)", () => {
    expect(CSS).not.toMatch(/--lg-row-highlight:[^;]*gradient/);
    expect(CSS).not.toMatch(/--lg-sidebar-selection:[^;]*(gradient|brand)/);
  });

  it("aucune primitive que la feuille du téléviseur LG refuserait", () => {
    expect(CSS).not.toMatch(/\b(min|max|clamp|color-mix)\(/);
  });

  it("importés juste après les jetons du verre, avant les surfaces qui les lisent", () => {
    const index = readFileSync(join(__dirname, "..", "..", "index.css"), "utf8");
    const at = (file: string) => index.indexOf(`@import "./theme/${file}"`);
    expect(at("glass/surfaceTokens.css")).toBeGreaterThan(at("liquidGlassTokens.css"));
    expect(at("glass/surfaceTokens.css")).toBeLessThan(at("liquidGlassSurface.css"));
  });
});
