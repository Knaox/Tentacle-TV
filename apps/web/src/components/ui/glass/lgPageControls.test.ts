/**
 * Les contrôles des pages en VERRE (lot lg4) — tenu sur les feuilles :
 * porte native, jamais dans un verre, aucun flou sur un remplissage opaque,
 * seuls `scale` / `transform` / `opacity` / `color` en transition, et les
 * libellés lisibles (AA) sur chaque verre, en sombre comme en clair.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const strip = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, "");
const TOKENS = strip(readFileSync(join(__dirname, "lgPageControls.css"), "utf8"));
const SKIN = strip(readFileSync(join(__dirname, "lgPageGlass.css"), "utf8"))
  + strip(readFileSync(join(__dirname, "lgPageButtons.css"), "utf8"));
const CONTENT = strip(readFileSync(join(__dirname, "../../../theme/liquidGlassContent.css"), "utf8"));

const rules = (source: string): Array<[string, string]> =>
  [...source.replace(/@media[^{]*\{([\s\S]*?\})\s*\}/g, "$1").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, s, b]) => [s.trim(), b]);

const token = (block: string, name: string): string => {
  const match = new RegExp(`${name}:\\s*([^;]+);`).exec(block);
  if (!match) throw new Error(`${name} absent`);
  return match[1];
};

/** Les sélecteurs d'une liste (virgules hors parenthèses ; `\(` échappé ne compte pas). */
function splitTop(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < list.length; i += 1) {
    const ch = list[i];
    if (ch === "\\") {
      current += ch + list[i + 1];
      i += 1;
      continue;
    }
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(current.trim());
      current = "";
    } else current += ch;
  }
  return [...out, current.trim()];
}

type Rgba = [number, number, number, number];

/** `rgba(…)`, `#rrggbb` → [r, g, b, a] (0-255, 0-1). */
function parse(color: string): Rgba {
  const hex = /#([0-9a-f]{6})/i.exec(color);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)).concat(1) as Rgba;
  const [r, g, b, a = 1] = /rgba?\(([^)]+)\)/.exec(color)![1].split(",").map(Number);
  return [r, g, b, a];
}

const over = (top: Rgba, base: Rgba): Rgba =>
  [0, 1, 2].map((i) => top[i] * top[3] + base[i] * (1 - top[3])).concat(1) as Rgba;

function luminance([r, g, b]: Rgba): number {
  const lin = (c: number) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const contrast = (a: Rgba, b: Rgba): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Les couches de premier niveau d'un `background` (virgules hors parenthèses). */
function layersOf(fill: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of fill) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(current.trim());
      current = "";
    } else current += ch;
  }
  return [...out, current.trim()].filter(Boolean);
}

/** Remplace les `var(--lgp-…)` par leur valeur dans le bloc racine. */
const resolve = (value: string): string =>
  value.replace(/var\((--lgp-[a-z-]+)\)/g, (_m, name: string) => resolve(token(ROOT, name)));

/**
 * Le PIRE point d'un remplissage en couches (reflet compris), sur `base` : de
 * chaque couche, l'arrêt le plus couvrant (le haut du dégradé, le cœur du
 * reflet), empilés — là où un libellé a le moins de contraste.
 */
function stackAll(fill: string, base: Rgba): Rgba {
  const worst = layersOf(resolve(fill)).map((layer) =>
    [...layer.matchAll(/rgba?\([^)]+\)|#[0-9a-f]{6}/gi)].map(([c]) => parse(c)).sort((x, y) => y[3] - x[3])[0]);
  expect(worst.length).toBeGreaterThan(0);
  return worst.filter(Boolean).reverse().reduce((acc, c) => over(c, acc), base);
}

const ROOT = rules(TOKENS).find(([s]) => s === ':root[data-liquid-glass="native"]')![1];
const DARK_PANEL = parse("#18181b");
const LIGHT_PANEL = parse("#ffffff");

describe("les contrôles des pages en verre", () => {
  it("chaque règle est portée par la porte native", () => {
    for (const [selector] of [...rules(TOKENS), ...rules(SKIN)]) {
      expect(selector, selector).toMatch(/\[data-liquid-glass="native"\]/);
    }
  });

  it("la peau ne touche JAMAIS un verre (menu, feuille, barre latérale, surface)", () => {
    for (const [selector, body] of rules(SKIN)) {
      if (!/background|box-shadow/.test(body) || !/\.lg-page/.test(selector)) continue;
      for (const part of splitTop(selector)) {
        expect(part, part).toMatch(/:not\(:where\(\[data-lg-scale="surface"\], \.lg-surface, \.lg-menu, \.lg-sheet, \[role="dialog"\](, \.lg-tray)?\) \*\)|:active|\.lg-page \.ctl-switch \.ctl-switch-thumb/);
      }
    }
  });

  it("aucun flou : un verre posé sur un remplissage opaque n'a rien à réfracter", () => {
    for (const [selector, body] of rules(SKIN)) {
      expect(body, selector).not.toMatch(/backdrop-filter:(?!\s*none)/);
    }
  });

  it("n'anime que scale, transform, opacity et la couleur du libellé", () => {
    for (const [selector, body] of rules(SKIN)) {
      const transition = /transition:([^;]+);/.exec(body)?.[1];
      if (!transition) continue;
      for (const part of transition.split(/,(?![^(]*\))/)) {
        expect(part.trim().split(/\s+/)[0], selector).toMatch(/^(scale|transform|opacity|color)$/);
      }
    }
  });

  it("chaque jeton existe pour les DEUX tons", () => {
    for (const name of ["fill", "fill-hover", "edge", "depth", "glyph", "glyph-secondary", "lens-fill", "lens-edge", "lens-depth", "track", "track-edge"]) {
      expect(ROOT).toContain(`--lgp-${name}-on-dark:`);
      expect(ROOT).toContain(`--lgp-${name}-on-light:`);
    }
  });

  it("les libellés tiennent l'AA sur le verre, au plus clair du reflet (sombre)", () => {
    const glyph = parse(token(ROOT, "--lgp-glyph-on-dark"));
    const secondary = parse(token(ROOT, "--lgp-glyph-secondary-on-dark"));
    for (const fill of ["--lgp-fill-on-dark", "--lgp-fill-hover-on-dark"]) {
      const bg = stackAll(token(ROOT, fill), DARK_PANEL);
      expect(contrast(over(glyph, bg), bg), fill).toBeGreaterThanOrEqual(4.5);
      expect(contrast(over(secondary, bg), bg), fill).toBeGreaterThanOrEqual(4.5);
    }
    const track = over(parse(token(ROOT, "--lgp-track-on-dark")), DARK_PANEL);
    const lens = stackAll(token(ROOT, "--lgp-lens-fill-on-dark"), track);
    expect(contrast(parse("#ffffff"), lens)).toBeGreaterThanOrEqual(4.5);
  });

  it("les libellés tiennent l'AA sur le verre (clair)", () => {
    const glyph = parse(token(ROOT, "--lgp-glyph-on-light"));
    const secondary = parse(token(ROOT, "--lgp-glyph-secondary-on-light"));
    for (const fill of ["--lgp-fill-on-light", "--lgp-fill-hover-on-light", "--lgp-lens-fill-on-light"]) {
      const bg = stackAll(token(ROOT, fill), parse("#f4f4f7"));
      expect(contrast(over(glyph, bg), bg), fill).toBeGreaterThanOrEqual(4.5);
      expect(contrast(over(secondary, bg), bg), fill).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("le danger se lit sur le verre, aux deux tons", () => {
    const darkBg = stackAll(token(ROOT, "--lgp-fill-hover-on-dark"), DARK_PANEL);
    const lightBg = stackAll(token(ROOT, "--lgp-fill-on-light"), LIGHT_PANEL);
    // Les valeurs de repli sont celles du socle (`--lg-danger-on-*`).
    const fallback = (name: string) => /,\s*(#[0-9a-f]{6})\)/i.exec(token(ROOT, name))![1];
    expect(contrast(parse(fallback("--lgp-danger-on-dark")), darkBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(parse(fallback("--lgp-danger-on-light")), lightBg)).toBeGreaterThanOrEqual(4.5);
  });

  it("« Partager » : la marque du libellé reste lisible sur le verre", () => {
    const content = rules(CONTENT);
    const dark = content.find(([s]) => s === ':root[data-liquid-glass="native"]')![1];
    const light = content.find(([s]) => s === ':root[data-liquid-glass="native"][data-theme="light"]')![1];
    const darkBg = stackAll(token(ROOT, "--lgp-fill-hover-on-dark"), DARK_PANEL);
    const lightBg = stackAll(token(ROOT, "--lgp-fill-on-light"), LIGHT_PANEL);
    expect(contrast(parse(token(dark, "--lgd-accent-fg")), darkBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(parse(token(light, "--lgd-accent-fg")), lightBg)).toBeGreaterThanOrEqual(4.5);
  });

  it("un filtre posé est teinté de l'accent UNI, jamais du dégradé de marque", () => {
    const tint = token(ROOT, "--lgp-tint-fill");
    expect(tint).toContain("var(--brand-dark)");
    expect(tint).not.toMatch(/--cta-brand-gradient|--lg-prominent-gradient|brand-accent/);
    // Blanc sur l'accent le plus clair des deux thèmes (#7C3AED, sombre), reflet compris.
    const top = over(parse("rgba(255,255,255,0.08)"), over([0x7c, 0x3a, 0xed, 0.94], DARK_PANEL));
    expect(contrast(parse("#ffffff"), top)).toBeGreaterThanOrEqual(4.5);
  });

  it("l'action principale (`glassProminent`) : blanc ≥ 4,5:1 aux deux bouts du dégradé", () => {
    expect(token(ROOT, "--lgp-prominent-gradient")).toMatch(/var\(--brand-dark\)[\s\S]*82%, black/);
    const sheen = parse("rgba(255,255,255,0.1)");
    // Les bouts les plus clairs des deux thèmes : #7C3AED, et #DB2777 assombri à 82 %.
    const pink: Rgba = [0xdb * 0.82, 0x27 * 0.82, 0x77 * 0.82, 1];
    for (const end of [parse("#7c3aed"), pink]) {
      expect(contrast(parse("#ffffff"), over(sheen, end))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("une tuile (rembourrée, alignée à gauche) n'est jamais prise pour un bouton", () => {
    for (const [selector] of rules(SKIN)) {
      if (!selector.includes(":is(button, a")) continue;
      for (const part of splitTop(selector)) {
        if (/bg-danger-surface|bg-cta-primary-bg\b/.test(part) && !part.includes(".p-3")) continue;
        expect(part, part).toMatch(/\.p-3, \.p-4, \.p-5, \.p-6, \.text-left/);
      }
    }
  });

  it("« Réduire la transparence » rend le verre plein, mouvement réduit le fige", () => {
    const material = rules(TOKENS).find(([s]) => s === ':root[data-liquid-glass="native"][data-lg-material]')![1];
    for (const name of ["fill-on-dark", "fill-on-light", "lens-fill-on-dark", "lens-fill-on-light"]) {
      expect(token(material, `--lgp-${name}`)).not.toMatch(/rgba|radial/);
    }
    const reduce = rules(TOKENS).find(([s]) => s.includes('[data-lg-motion="reduce"]'))![1];
    expect(token(reduce, "--lgp-press-scale")).toBe("1");
    expect(token(reduce, "--lgp-lens-press-scale")).toBe("1");
  });
});
