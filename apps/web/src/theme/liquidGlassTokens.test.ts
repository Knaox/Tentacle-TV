/**
 * Les jetons du verre (`liquidGlassTokens.css`) : présents en sombre ET en
 * clair, jamais dans `tokens.css`, et lus SEULEMENT sous le mode natif.
 *
 * Le dernier point est la garantie du « rendu d'avant au pixel près » hors
 * macOS 26 : une règle qui lirait un jeton `--lg-*` ou une classe `.lg-*` sans
 * la portée `[data-liquid-glass="native"]` changerait le web, Windows et Linux.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const THEME = __dirname;
const SRC = join(__dirname, "..");
const CSS = readFileSync(join(THEME, "liquidGlassTokens.css"), "utf8");

/** Le corps d'un bloc de premier niveau `sélecteur { … }`. */
function blockFor(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Bloc introuvable : ${selector}`);
  const from = source.indexOf("{", start);
  let depth = 0;
  for (let i = from; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) return source.slice(from + 1, i);
  }
  throw new Error(`Bloc non refermé : ${selector}`);
}

const declared = (block: string): Set<string> =>
  new Set(Array.from(block.matchAll(/^\s*(--lg-[a-z0-9-]+)\s*:/gim), (m) => m[1]));

const ROOT = declared(blockFor(CSS, ":root"));
const LIGHT = declared(blockFor(CSS, ':root[data-theme="light"]'));
const LEVELS = ["regular", "clear", "tinted", "prominent"] as const;

describe("les jetons du verre", () => {
  it("chaque niveau a son remplissage, son flou, sa saturation, sa luminosité, sa réfraction, sa teinte native", () => {
    for (const level of LEVELS) {
      for (const name of [
        `--lg-${level}-fill`,
        `--lg-${level}-blur`,
        `--lg-${level}-saturate`,
        `--lg-${level}-brightness`,
        `--lg-refraction-${level}`,
        `--lg-native-tint-${level}`,
      ]) {
        expect(ROOT, name).toContain(name);
      }
    }
  });

  it("le reste du matériau : spéculaire, ombres, rayons, épaisseurs, durées", () => {
    for (const name of [
      "--lg-rim",
      "--lg-rim-width",
      "--lg-specular-strong",
      "--lg-specular-soft",
      "--lg-highlight",
      "--lg-light-x",
      "--lg-light-y",
      "--lg-shadow-contact",
      "--lg-shadow-float",
      "--lg-shadow-raised",
      "--lg-corner-shape",
      "--lg-radius-sm",
      "--lg-radius-md",
      "--lg-radius-lg",
      "--lg-radius-capsule",
      "--lg-bezel-sm",
      "--lg-bezel-md",
      "--lg-bezel-lg",
      "--lg-dispersion",
      "--lg-thickness-regular",
      "--lg-duration-press",
      "--lg-duration-morph",
      "--lg-ease-spring",
      "--lg-ease-smooth",
      "--lg-tint-gradient",
      "--lg-prominent-gradient",
    ]) {
      expect(ROOT, name).toContain(name);
    }
  });

  it("le clair redit ce qui porte la couleur : voiles, liseré, reflets, ombres, marque", () => {
    for (const name of [
      "--lg-regular-fill",
      "--lg-clear-fill",
      "--lg-rim",
      "--lg-specular-strong",
      "--lg-highlight",
      "--lg-shadow-contact",
      "--lg-shadow-float",
      "--lg-tint-gradient",
      "--lg-prominent-gradient",
    ]) {
      expect(LIGHT, name).toContain(name);
    }
  });

  it("le clair ne déclare rien que le sombre n'ait pas", () => {
    for (const name of LIGHT) expect(ROOT, name).toContain(name);
  });

  it("tout jeton lu dans la feuille y est déclaré", () => {
    for (const [, name] of CSS.matchAll(/var\((--lg-[a-z0-9-]+)/g)) {
      expect(ROOT, name).toContain(name);
    }
  });

  it("jamais dans tokens.css : le test de parité de l'admin le refuserait", () => {
    const tokens = readFileSync(join(THEME, "tokens.css"), "utf8");
    expect(tokens).not.toMatch(/--lg-[a-z]/);
  });

  it("importés juste après les surfaces, avant les règles qui les lisent", () => {
    const index = readFileSync(join(SRC, "index.css"), "utf8");
    const at = (file: string) => index.indexOf(`@import "./theme/${file}"`);
    expect(at("liquidGlassTokens.css")).toBeGreaterThan(at("tokens.css"));
    expect(at("liquidGlassTokens.css")).toBeGreaterThan(at("surfaces.css"));
  });

  it("aucune primitive que la feuille du téléviseur LG refuserait", () => {
    // `compatGuard` (apps/tv-webos) arrête le build sur ces fonctions sans repli.
    expect(CSS).not.toMatch(/\b(min|max|clamp|color-mix)\(/);
  });
});

/** Toutes les feuilles du client web. */
function cssFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) cssFiles(path, out);
    else if (name.endsWith(".css")) out.push(path);
  }
  return out;
}

describe("le rendu d'avant, intact hors du mode natif", () => {
  it("toute règle qui lit le verre est portée par [data-liquid-glass=\"native\"]", () => {
    const offenders: string[] = [];
    for (const file of cssFiles(SRC)) {
      if (file.endsWith("liquidGlassTokens.css")) continue;
      const source = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      // Règles de dernier niveau : `sélecteur { déclarations }`.
      for (const [, selector, body] of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const readsGlass = /var\(--lg-/.test(body) || /\.lg-[a-z]/.test(selector);
        if (!readsGlass) continue;
        if (selector.includes('[data-liquid-glass="native"]')) continue;
        offenders.push(`${file.slice(SRC.length)} → ${selector.trim().slice(0, 80)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
