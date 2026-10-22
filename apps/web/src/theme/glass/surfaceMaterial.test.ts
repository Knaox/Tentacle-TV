/**
 * Le matériau du régime `surface` : la PREUVE du contraste (≥ 4,5:1 sur tout
 * dessous, pire blanc et pire noir compris), le plafond de la couleur qui
 * traverse (plus de taches), et la parité avec `surfaceTokens.css`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { BLACK, WCAG_AA_TEXT, WHITE, compositeOver, contrastRatio, parseColor, type Rgba } from "./contrast";
import {
  SURFACE_MATERIAL,
  backdropGrid,
  chromaTransfer,
  cssSaturate,
  surfaceColorOver,
  surfaceToneIsLegible,
  worstSurfaceContrast,
} from "./surfaceMaterial";

const TOKENS = readFileSync(join(__dirname, "surfaceTokens.css"), "utf8");
const BASE = readFileSync(join(__dirname, "..", "liquidGlassTokens.css"), "utf8");
const SURFACE_CSS = readFileSync(join(__dirname, "..", "liquidGlassSurface.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** La valeur déclarée d'un jeton (première occurrence). */
function token(source: string, name: string): string {
  const match = new RegExp(`${name}:\\s*([^;]+);`).exec(source);
  if (match === null) throw new Error(`Jeton absent : ${name}`);
  return match[1]!.trim();
}

const color = (name: string): Rgba => {
  const parsed = parseColor(token(TOKENS, name));
  if (parsed === null) throw new Error(`Couleur illisible : ${name}`);
  return parsed;
};

const PRIMARIES: Rgba[] = [
  { r: 255, g: 0, b: 0, a: 1 },
  { r: 0, g: 255, b: 0, a: 1 },
  { r: 0, g: 0, b: 255, a: 1 },
  { r: 139, g: 92, b: 246, a: 1 }, // le violet de la marque
  { r: 255, g: 140, b: 0, a: 1 }, // orange
  { r: 0, g: 200, b: 120, a: 1 }, // vert
];

describe("le contraste du texte sur une surface, quel que soit le dessous", () => {
  for (const tone of ["dark", "light"] as const) {
    const m = SURFACE_MATERIAL[tone];
    it(`ton ${tone} : principal, secondaire et danger ≥ 4,5:1 sur 216 dessous`, () => {
      for (const [label, text] of [
        ["principal", m.glyph],
        ["secondaire", m.glyphSecondary],
        ["danger", m.danger],
      ] as const) {
        expect(worstSurfaceContrast(text, tone), `${tone} ${label}`).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      }
      expect(surfaceToneIsLegible(tone)).toBe(true);
    });
  }

  it("le pire cas est bien le blanc pur (ton sombre) et le noir pur (ton clair)", () => {
    const dark = worstSurfaceContrast(SURFACE_MATERIAL.dark.glyphSecondary, "dark");
    const light = worstSurfaceContrast(SURFACE_MATERIAL.light.glyphSecondary, "light");
    expect(worstSurfaceContrast(SURFACE_MATERIAL.dark.glyphSecondary, "dark", SURFACE_MATERIAL, [WHITE])).toBeCloseTo(dark, 6);
    expect(worstSurfaceContrast(SURFACE_MATERIAL.light.glyphSecondary, "light", SURFACE_MATERIAL, [BLACK])).toBeCloseTo(light, 6);
  });

  it("le voile d'avant (0,07, saturation 1,5) échouait : la preuve mord", () => {
    const thin = {
      ...SURFACE_MATERIAL,
      saturate: 1.5,
      dark: { ...SURFACE_MATERIAL.dark, fill: { r: 255, g: 255, b: 255, a: 0.07 } },
    };
    expect(surfaceToneIsLegible("dark", thin)).toBe(false);
  });

  it("la pastille d'un menu (accent UNI, opaque) tient le blanc, dans les deux thèmes", () => {
    // `--brand-dark` (sombre) et `--brand` (clair) du thème par défaut (tokens.css) : le même #7C3AED.
    expect(contrastRatio(WHITE, parseColor("#7C3AED")!)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });
});

describe("plus de taches de couleur", () => {
  it("surface : le dessous n'est jamais avivé, au plus 20 % de sa couleur traverse", () => {
    expect(SURFACE_MATERIAL.saturate).toBeLessThanOrEqual(1);
    for (const tone of ["dark", "light"] as const) {
      for (const backdrop of PRIMARIES) expect(chromaTransfer(backdrop, tone)).toBeLessThanOrEqual(0.2);
    }
  });

  it("contrôle : le dessous n'est avivé que de 30 % au plus (1,5 avant)", () => {
    for (const name of ["--lg-regular-saturate", "--lg-tinted-saturate"]) {
      for (const block of [BASE.slice(BASE.indexOf(":root {")), BASE.slice(BASE.indexOf(':root[data-theme="light"] {'))]) {
        expect(Number.parseFloat(token(block, name)), name).toBeLessThanOrEqual(1.3);
      }
    }
    // Un rouge pur traverse un contrôle à peine plus vif qu'il n'est.
    const red = cssSaturate({ r: 200, g: 60, b: 60, a: 1 }, 1.3);
    expect(red.r - red.g).toBeLessThanOrEqual(1.3 * 140 + 1);
  });

  it("le flou d'une surface diffuse vraiment (plus épais qu'un contrôle et que l'ancien « épais »)", () => {
    expect(SURFACE_MATERIAL.blur).toBeGreaterThan(Number.parseFloat(token(BASE, "--lg-thick-blur")));
    expect(SURFACE_MATERIAL.refraction).toBeLessThan(Number.parseFloat(token(BASE, "--lg-refraction-regular")));
  });
});

describe("parité avec surfaceTokens.css", () => {
  it("les nombres", () => {
    expect(Number.parseFloat(token(TOKENS, "--lg-surface-blur"))).toBe(SURFACE_MATERIAL.blur);
    expect(Number.parseFloat(token(TOKENS, "--lg-surface-saturate"))).toBe(SURFACE_MATERIAL.saturate);
    expect(Number.parseFloat(token(TOKENS, "--lg-surface-brightness"))).toBe(SURFACE_MATERIAL.brightness);
    expect(Number.parseFloat(token(TOKENS, "--lg-refraction-surface"))).toBe(SURFACE_MATERIAL.refraction);
  });

  it("les couleurs de chaque ton", () => {
    for (const tone of ["dark", "light"] as const) {
      const m = SURFACE_MATERIAL[tone];
      expect(color(`--lg-surface-fill-on-${tone}`)).toEqual(m.fill);
      expect(color(`--lg-surface-sheen-on-${tone}`)).toEqual(m.sheen);
      expect(color(`--lg-surface-glyph-on-${tone}`)).toEqual(m.glyph);
      expect(color(`--lg-surface-glyph-on-${tone}-secondary`)).toEqual(m.glyphSecondary);
      expect(color(`--lg-surface-danger-on-${tone}`)).toEqual(m.danger);
    }
  });

  it("l'intitulé de section est le secondaire prouvé", () => {
    expect(TOKENS).toMatch(/--lg-section-label:\s*var\(--lg-surface-glyph-on-dark-secondary\)/);
    expect(TOKENS).toMatch(/--lg-section-label:\s*var\(--lg-surface-glyph-on-light-secondary\)/);
  });
});

describe("« Réduire la transparence » et « Contraste accru » (accessibility.ts)", () => {
  it("le régime `surface` s'efface devant l'aplat de physics.css", () => {
    const selectors = Array.from(SURFACE_CSS.matchAll(/([^{}]+)\{/g), (m) => m[1]!.trim()).filter((sel) =>
      sel.includes('[data-lg-scale="surface"]'),
    );
    expect(selectors.length).toBeGreaterThanOrEqual(4);
    for (const sel of selectors) expect(sel).toContain(":not([data-lg-material])");
  });

  it("l'aplat du thème garde les textes du thème lisibles (ton = thème)", () => {
    // `--lg-a11y-solid` : `--surface-3` en sombre, `--surface-2` en clair (tokens.css).
    const darkSolid = parseColor("#1f1f1f")!;
    const lightSolid = parseColor("#ECECF1")!;
    const onDark = parseColor(token(BASE, "--lg-glyph-on-dark-secondary"))!;
    const onLight = parseColor(token(BASE, "--lg-glyph-on-light-secondary"))!;
    const flat = (text: Rgba, under: Rgba) => contrastRatio(compositeOver(text, under), under);
    expect(flat(onDark, darkSolid)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    expect(flat(onLight, lightSolid)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });
});

describe("le modèle", () => {
  it("une surface sombre sur du blanc reste sombre, une claire sur du noir reste claire", () => {
    expect(surfaceColorOver(WHITE, "dark").r).toBeLessThan(100);
    expect(surfaceColorOver(BLACK, "light").r).toBeGreaterThan(160);
  });

  it("la grille couvre blanc, noir et primaires", () => {
    const grid = backdropGrid();
    expect(grid).toHaveLength(216);
    expect(grid).toContainEqual(WHITE);
    expect(grid).toContainEqual(BLACK);
  });
});
