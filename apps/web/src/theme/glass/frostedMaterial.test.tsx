/**
 * Le panneau givré posé sur une IMAGE (`frostedMaterial.ts`) : la PREUVE de sa lisibilité sur
 * n'importe quel dessous, et ses valeurs recopiées à l'identique dans la feuille et le filtre.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WCAG_AA_TEXT, type Rgba } from "./contrast";
import {
  FROST_BLUR_PX,
  FROST_CURVE,
  FROST_CURVE_ID,
  FROST_SATURATE,
  FROSTED_DARK,
  FROSTED_LIGHT,
  curveChannel,
  frostedColorOver,
  worstFrostedContrast,
} from "./frostedMaterial";
import { PANE_DARK, PANE_LIGHT, paneColorOver, sheenCorner } from "./paneMaterial";

const state = vi.hoisted(() => ({ mode: "off" as "native" | "refraction" | "off" }));
vi.mock("../useLiquidGlass", () => ({ useLiquidGlassMode: () => state.mode }));
const { GlassToneCurves } = await import("./GlassToneCurves");

const strip = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, "");
const TOKENS = strip(readFileSync(join(__dirname, "paneTokens.css"), "utf8"));
const CONTENT = strip(readFileSync(join(__dirname, "..", "paneContent.css"), "utf8"));

function block(selectorStart: string): Map<string, string> {
  const at = TOKENS.indexOf(selectorStart);
  if (at === -1) throw new Error(`bloc introuvable : ${selectorStart}`);
  const body = TOKENS.slice(TOKENS.indexOf("{", at) + 1, TOKENS.indexOf("}", at));
  const out = new Map<string, string>();
  for (const [, name, value] of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out.set(name as string, (value as string).replace(/\s+/g, " ").trim());
  return out;
}

const DARK = block(':root[data-liquid-glass="native"],\n:root[data-liquid-glass="native"] [data-lg-tone="dark"]');
const LIGHT = block(':root[data-liquid-glass="native"][data-theme="light"],\n:root[data-liquid-glass="native"] [data-lg-tone="light"]');
const rgba = (c: Rgba) => `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`;
const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };
const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };

describe("lisible sur N'IMPORTE quelle image (216 dessous, blanc et noir purs compris)", () => {
  for (const [name, tone] of [["sombre", FROSTED_DARK], ["clair", FROSTED_LIGHT]] as const) {
    it(`${name} : le texte principal ≥ 4,5:1, du corps au coin du reflet`, () => {
      expect(worstFrostedContrast(tone.glyph, tone, tone.whiteBody)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      expect(worstFrostedContrast(tone.glyph, tone, tone.whiteCorner)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });
    it(`${name} : tout texte secondaire (compte, invite, libellé d'un segment) ≥ 4,5:1, coin du reflet compris`, () => {
      expect(worstFrostedContrast(tone.glyphSecondary, tone, tone.whiteBody)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      expect(worstFrostedContrast(tone.glyphSecondary, tone, tone.whiteCorner)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });
    it(`${name} : un libellé secondaire sur la piste d'un segmenté posée dans le verre ≥ 4,5:1`, () => {
      expect(worstFrostedContrast(tone.glyphSecondary, tone, tone.whiteBody, tone.track)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      expect(worstFrostedContrast(tone.glyphSecondary, tone, (tone.whiteBody + tone.whiteCorner) / 2, tone.track)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });
  }

  it("le verre de la maquette, lui, échouait sur une image : la courbe est utile (garde-fou du test)", () => {
    const over = (backdrop: Rgba) => paneColorOver(backdrop, PANE_DARK, sheenCorner(PANE_DARK));
    // Un ciel blanc sous le panneau sombre de la maquette : du blanc sous un texte blanc.
    expect(over(WHITE).r).toBeGreaterThan(200);
    expect(paneColorOver(BLACK, PANE_LIGHT, PANE_LIGHT.fillBody).r).toBeLessThan(60);
  });
});

describe("la courbe ne teinte que ce que l'image exige", () => {
  it("sombre : une ombre passe telle quelle (le verre reste transparent), un blanc est plafonné", () => {
    expect(curveChannel(0, FROST_CURVE.dark)).toBe(0);
    expect(curveChannel(24, FROST_CURVE.dark)).toBeGreaterThan(20);
    expect(curveChannel(255, FROST_CURVE.dark)).toBeLessThan(0.33 * 255);
  });
  it("clair : un blanc passe tel quel, un noir devient une nacre", () => {
    expect(curveChannel(255, FROST_CURVE.light)).toBe(255);
    expect(curveChannel(0, FROST_CURVE.light)).toBeGreaterThan(0.7 * 255);
  });
  it("monotones : jamais une image inversée ni une cassure de ton", () => {
    for (const table of [FROST_CURVE.dark, FROST_CURVE.light]) {
      for (let i = 1; i < table.length; i++) expect(table[i]).toBeGreaterThanOrEqual(table[i - 1]);
    }
  });
  it("une image sombre sous le verre sombre reste presque elle-même", () => {
    const dim: Rgba = { r: 30, g: 22, b: 40, a: 1 };
    const glass = frostedColorOver(dim, FROSTED_DARK, FROSTED_DARK.whiteBody);
    expect(Math.abs(glass.r - dim.r)).toBeLessThan(14);
    expect(Math.abs(glass.b - dim.b)).toBeLessThan(14);
  });
});

describe("les valeurs recopiées du modèle", () => {
  it("les jetons du givre (paneTokens.css), sombre puis clair", () => {
    expect(DARK.get("--lg-frost-blur")).toBe(`${FROST_BLUR_PX}px`);
    expect(Number(DARK.get("--lg-frost-saturate"))).toBe(FROST_SATURATE);
    expect(DARK.get("--lg-frost-curve")).toBe(`url(#${FROST_CURVE_ID.dark})`);
    expect(DARK.get("--lg-frost-ink")).toBe(rgba(FROSTED_DARK.ink));
    expect(DARK.get("--lg-frost-glyph-secondary")).toBe(rgba(FROSTED_DARK.glyphSecondary));
    expect(LIGHT.get("--lg-frost-curve")).toBe(`url(#${FROST_CURVE_ID.light})`);
    expect(LIGHT.get("--lg-frost-ink")).toBe(rgba(FROSTED_LIGHT.ink));
    expect(LIGHT.get("--lg-frost-glyph-secondary")).toBe(rgba(FROSTED_LIGHT.glyphSecondary));
  });
  it("le dégradé et les reflets sont ceux du panneau (le coin et le corps du modèle)", () => {
    expect(FROSTED_DARK.whiteCorner).toBeCloseTo(sheenCorner(PANE_DARK), 6);
    expect(FROSTED_LIGHT.whiteCorner).toBeCloseTo(sheenCorner(PANE_LIGHT), 6);
    expect(FROSTED_DARK.whiteBody).toBe(PANE_DARK.fillBody);
    expect(FROSTED_LIGHT.whiteBody).toBe(PANE_LIGHT.fillBody);
  });
  it("le panneau lit la courbe APRÈS le flou et la saturation, et relève ses encres faibles", () => {
    const rule = /\.lg-content\.lg-content-frosted\s*\{([^}]+)\}/.exec(CONTENT)![1];
    expect(rule).toMatch(/backdrop-filter:\s*blur\(var\(--lg-frost-blur\)\)\s+saturate\(var\(--lg-frost-saturate\)\)\s+var\(--lg-frost-curve\)/);
    expect(rule).toContain("linear-gradient(var(--lg-frost-ink), var(--lg-frost-ink))");
    for (const ink of ["--text-secondary", "--text-tertiary", "--text-quaternary", "--lgp-glyph-secondary"]) {
      expect(rule).toContain(`${ink}: var(--lg-frost-glyph-secondary)`);
    }
  });
  it("« Réduire la transparence » : un aplat, aucun givre ni courbe", () => {
    const rule = /\[data-lg-material\] \.lg-content\.lg-content-frosted\s*\{([^}]+)\}/.exec(CONTENT)![1];
    expect(rule).toContain("backdrop-filter: none");
    expect(rule).toContain("var(--lg-a11y-solid)");
  });
});

describe("les filtres montés (GlassToneCurves)", () => {
  it("hors du mode natif : rien", () => {
    for (const mode of ["off", "refraction"] as const) {
      state.mode = mode;
      expect(renderToStaticMarkup(<GlassToneCurves />)).toBe("");
    }
  });
  it("en natif : les deux courbes du modèle, en sRVB, sur les trois canaux", () => {
    state.mode = "native";
    const html = renderToStaticMarkup(<GlassToneCurves />);
    for (const tone of ["dark", "light"] as const) {
      const filter = new RegExp(`<filter id="${FROST_CURVE_ID[tone]}"[^>]*color-interpolation-filters="sRGB"[^>]*>(.*?)</filter>`).exec(html);
      expect(filter, tone).not.toBeNull();
      const tables = [...filter![1].matchAll(/tableValues="([^"]+)"/g)].map((m) => m[1]);
      expect(tables).toEqual([FROST_CURVE[tone].join(" "), FROST_CURVE[tone].join(" "), FROST_CURVE[tone].join(" ")]);
    }
  });
});
