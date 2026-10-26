/**
 * Le verre de la maquette (`paneMaterial.ts`, `paneTokens.css`) : la PREUVE de
 * sa lisibilité sur le fond ambiant, et les jetons recopiés à l'identique.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { relativeLuminance, WCAG_AA_LARGE, WCAG_AA_TEXT, type Rgba } from "./contrast";
import {
  AMBIENT_DARK,
  AMBIENT_INK,
  AMBIENT_LIGHT,
  AMBIENT_TINT_ALPHA,
  AMBIENT_TINT_MAX_LUMINANCE,
  BEAD_DARK,
  BEAD_LIGHT,
  PANE_BLUR_PX,
  PANE_DARK,
  PANE_LIGHT,
  PANE_PROMINENT,
  capTintLuminance,
  paneBody,
  sheenCorner,
  worstPaneContrast,
  type AmbientBlob,
} from "./paneMaterial";

const CSS = readFileSync(join(__dirname, "paneTokens.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const PAGE_LIGHT: Rgba = { r: 244, g: 244, b: 247, a: 1 };

function block(selectorStart: string): Map<string, string> {
  const at = CSS.indexOf(selectorStart);
  if (at === -1) throw new Error(`bloc introuvable : ${selectorStart}`);
  const body = CSS.slice(CSS.indexOf("{", at) + 1, CSS.indexOf("}", at));
  const out = new Map<string, string>();
  for (const [, name, value] of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out.set(name as string, (value as string).replace(/\s+/g, " ").trim());
  return out;
}

const DARK = block(':root[data-liquid-glass="native"],\n:root[data-liquid-glass="native"] [data-lg-tone="dark"]');
const LIGHT = block(':root[data-liquid-glass="native"][data-theme="light"],\n:root[data-liquid-glass="native"] [data-lg-tone="light"]');
const AMBIENT = block(':root[data-liquid-glass="native"] {\n  --lg-ambient-1');
const AMBIENT_L = block(':root[data-liquid-glass="native"][data-theme="light"] {\n  --lg-ambient-1-a');

/** Les teintes d'image possibles au pire : les couleurs pures les plus lumineuses, bornées. */
const IMAGE_TINTS: AmbientBlob[] = [
  { r: 255, g: 255, b: 0 },
  { r: 255, g: 255, b: 255 },
  { r: 0, g: 255, b: 255 },
  { r: 0, g: 255, b: 0 },
  { r: 255, g: 128, b: 0 },
  { r: 255, g: 0, b: 0 },
].map((c) => ({ token: "image", color: capTintLuminance({ ...c, a: 1 }), alpha: AMBIENT_TINT_ALPHA.dark }));

const alphaOf = (color: Rgba, a: number): Rgba => ({ ...color, a });

describe("la lisibilité du verre sur le fond ambiant (sombre)", () => {
  const blobs = [...AMBIENT_DARK, ...IMAGE_TINTS];
  it("le CORPS du verre : texte blanc ≥ 4,5:1 sur le pire croisement de deux taches", () => {
    expect(worstPaneContrast(PANE_DARK.glyph, PANE_DARK, blobs, AMBIENT_INK, paneBody(PANE_DARK))).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });
  it("le coin du REFLET : ≥ 3:1 (grand texte, icônes)", () => {
    expect(worstPaneContrast(PANE_DARK.glyph, PANE_DARK, blobs, AMBIENT_INK, sheenCorner(PANE_DARK))).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
  });
  it("le texte secondaire : ≥ 3:1 dans le corps", () => {
    expect(worstPaneContrast(PANE_DARK.glyphSecondary, PANE_DARK, blobs, AMBIENT_INK, paneBody(PANE_DARK))).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
  });
  it("la pastille : texte blanc ≥ 4,5:1", () => {
    const bead = { ...PANE_DARK, saturate: BEAD_DARK.saturate, brightness: 1, ink: BEAD_DARK.ink };
    expect(worstPaneContrast(PANE_DARK.glyph, bead, blobs, AMBIENT_INK, BEAD_DARK.fill)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });
  it("l'action principale : texte blanc ≥ 4,5:1 aux deux bouts du dégradé, reflet compris", () => {
    for (const stop of [PANE_PROMINENT.from, PANE_PROMINENT.to]) {
      const prominent = { ...PANE_DARK, ink: stop };
      expect(worstPaneContrast(PANE_DARK.glyph, prominent, blobs, AMBIENT_INK, PANE_DARK.sheen)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    }
  });
  it("la maquette telle quelle échouait : la borne est utile (garde-fou du test)", () => {
    const mockup = { ...PANE_DARK, ink: alphaOf(AMBIENT_INK, 0), sheen: 0.22 };
    const loud = blobs.map((b) => ({ ...b, alpha: 0.55 }));
    expect(worstPaneContrast(PANE_DARK.glyph, mockup, loud, AMBIENT_INK, sheenCorner(mockup))).toBeLessThan(WCAG_AA_LARGE);
  });
});

describe("la lisibilité du verre sur le fond ambiant (clair)", () => {
  const tints = IMAGE_TINTS.map((t) => ({ ...t, alpha: AMBIENT_TINT_ALPHA.light }));
  const blobs = [...AMBIENT_LIGHT, ...tints];
  it("texte sombre ≥ 4,5:1, secondaire ≥ 4,5:1, au plus pâle comme au plus vif", () => {
    for (const white of [PANE_LIGHT.fillBody, paneBody(PANE_LIGHT), sheenCorner(PANE_LIGHT)]) {
      expect(worstPaneContrast(PANE_LIGHT.glyph, PANE_LIGHT, blobs, PAGE_LIGHT, white)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      expect(worstPaneContrast(PANE_LIGHT.glyphSecondary, PANE_LIGHT, blobs, PAGE_LIGHT, white)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    }
    const bead = { ...PANE_LIGHT, saturate: BEAD_LIGHT.saturate, brightness: 1, ink: BEAD_LIGHT.ink };
    expect(worstPaneContrast(PANE_LIGHT.glyph, bead, blobs, PAGE_LIGHT, BEAD_LIGHT.fill)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });
});

describe("une teinte d'image est bornée", () => {
  it("à la luminance de nos roses, même teinte", () => {
    const yellow = capTintLuminance({ r: 255, g: 230, b: 0, a: 1 });
    expect(relativeLuminance(yellow)).toBeLessThanOrEqual(AMBIENT_TINT_MAX_LUMINANCE + 0.002);
    expect(yellow.r).toBeGreaterThan(yellow.b);
    const rose = { r: 124, g: 58, b: 237, a: 1 };
    expect(capTintLuminance(rose)).toEqual(rose);
  });
});

describe("les jetons recopiés du modèle (paneTokens.css)", () => {
  const rgba = (c: Rgba) => `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`;
  it("le panneau sombre", () => {
    expect(DARK.get("--lg-pane-blur")).toBe(`${PANE_BLUR_PX}px`);
    expect(Number(DARK.get("--lg-pane-saturate"))).toBe(PANE_DARK.saturate);
    expect(Number(DARK.get("--lg-pane-brightness"))).toBe(PANE_DARK.brightness);
    expect(DARK.get("--lg-pane-ink")).toBe(rgba(PANE_DARK.ink));
    expect(DARK.get("--lg-pane-fill")).toContain(`rgba(255, 255, 255, ${PANE_DARK.fillPeak}) 0%`);
    expect(DARK.get("--lg-pane-fill")).toContain(`rgba(255, 255, 255, ${PANE_DARK.fillBody}) 45%`);
    expect(DARK.get("--lg-pane-fill")).toContain(`rgba(255, 255, 255, ${PANE_DARK.fillEnd}) 100%`);
    expect(DARK.get("--lg-pane-sheen")).toContain(`rgba(255, 255, 255, ${PANE_DARK.sheen})`);
    expect(DARK.get("--lg-pane-sheen")).toContain(`rgba(255, 255, 255, ${PANE_DARK.sheenFar})`);
    expect(DARK.get("--lg-pane-glyph-secondary")).toBe(rgba(PANE_DARK.glyphSecondary));
    expect(DARK.get("--lg-bead-fill")).toBe(`rgba(255, 255, 255, ${BEAD_DARK.fill})`);
    expect(DARK.get("--lg-bead-ink")).toBe(rgba(BEAD_DARK.ink));
    expect(Number(DARK.get("--lg-bead-saturate"))).toBe(BEAD_DARK.saturate);
    expect(DARK.get("--lg-pane-prominent-fill")).toBe(`linear-gradient(140deg, ${rgba(PANE_PROMINENT.from)} 0%, ${rgba(PANE_PROMINENT.to)} 100%)`);
  });
  it("le panneau clair", () => {
    expect(Number(LIGHT.get("--lg-pane-saturate"))).toBe(PANE_LIGHT.saturate);
    expect(Number(LIGHT.get("--lg-pane-brightness"))).toBe(PANE_LIGHT.brightness);
    expect(LIGHT.get("--lg-pane-fill")).toContain(`rgba(255, 255, 255, ${PANE_LIGHT.fillPeak}) 0%`);
    expect(LIGHT.get("--lg-pane-fill")).toContain(`rgba(255, 255, 255, ${PANE_LIGHT.fillBody}) 45%`);
    expect(LIGHT.get("--lg-pane-fill")).toContain(`rgba(255, 255, 255, ${PANE_LIGHT.fillEnd}) 100%`);
    expect(LIGHT.get("--lg-pane-sheen")).toContain(`rgba(255, 255, 255, ${PANE_LIGHT.sheen})`);
    expect(LIGHT.get("--lg-pane-sheen")).toContain(`rgba(255, 255, 255, ${PANE_LIGHT.sheenFar})`);
    expect(LIGHT.get("--lg-pane-glyph")).toBe(rgba(PANE_LIGHT.glyph));
    expect(LIGHT.get("--lg-pane-glyph-secondary")).toBe(rgba(PANE_LIGHT.glyphSecondary));
    expect(LIGHT.get("--lg-bead-fill")).toBe(`rgba(255, 255, 255, ${BEAD_LIGHT.fill})`);
  });
  it("le clair ne déclare rien que le sombre n'ait pas", () => {
    for (const name of LIGHT.keys()) expect(DARK.has(name), name).toBe(true);
  });
  it("les taches du fond : mêmes opacités que le modèle, dans l'ordre", () => {
    AMBIENT_DARK.forEach((blob, i) => expect(Number(AMBIENT.get(`--lg-ambient-${i + 1}-a`)), blob.token).toBe(blob.alpha));
    AMBIENT_LIGHT.forEach((blob, i) => expect(Number(AMBIENT_L.get(`--lg-ambient-${i + 1}-a`)), blob.token).toBe(blob.alpha));
    expect(Number(AMBIENT.get("--lg-ambient-tint-a"))).toBe(AMBIENT_TINT_ALPHA.dark);
    expect(Number(AMBIENT_L.get("--lg-ambient-tint-a"))).toBe(AMBIENT_TINT_ALPHA.light);
  });
  it("aucune primitive que la feuille du téléviseur LG refuserait", () => {
    expect(CSS).not.toMatch(/\b(min|max|clamp|color-mix)\(/);
  });
});
