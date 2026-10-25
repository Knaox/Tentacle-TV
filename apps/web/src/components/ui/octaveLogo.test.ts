import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as octave from "./octaveLogo.generated";
import {
  OCTAVE_GLYPH_ON_DARK_SVG,
  OCTAVE_GLYPH_ON_LIGHT_SVG,
  OCTAVE_GLYPH_PATHS,
  OCTAVE_GLYPH_SVG,
  OCTAVE_GLYPH_VIEWBOX,
  OCTAVE_LOGO_SVG,
  octaveLogoDataUri,
  octaveLogoSvg,
} from "./octaveLogo.generated";

/** Les SVG que `brand/octave.py` écrit, que le module doit reprendre à l'identique. */
const BRAND = resolve(__dirname, "../../../../../brand/octave");
const FILES: Record<string, string> = {
  "logo-octave.svg": OCTAVE_LOGO_SVG,
  "glyph-octave.svg": OCTAVE_GLYPH_SVG,
  "glyph-octave-on-dark.svg": OCTAVE_GLYPH_ON_DARK_SVG,
  "glyph-octave-on-light.svg": OCTAVE_GLYPH_ON_LIGHT_SVG,
};

describe("logo d'Octave (module généré par brand/octave.py)", () => {
  it("chaque variante est un SVG vectoriel complet, sans texte ni image", () => {
    for (const svg of Object.values(FILES)) {
      expect(svg.startsWith("<svg ")).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
      expect(svg).toContain('viewBox="0 0 240 240"');
      expect(svg).not.toMatch(/<text|<image|\$\{|data:image\/png/);
    }
  });

  it("reprend à l'octet près les SVG de brand/octave/", () => {
    for (const [name, svg] of Object.entries(FILES)) {
      expect(svg).toBe(readFileSync(resolve(BRAND, name), "utf8").replace(/\n/g, ""));
    }
  });

  it("l'ancien logo est retiré : ni chapeau, ni tête de mort, ni mascotte monochrome", () => {
    for (const svg of Object.values(FILES)) {
      // Le tricorne (dégradé `gH`) et le masque du monochrome (`mOct`) de l'ancien dessin.
      expect(svg).not.toMatch(/url\(#gH\)|mOct|sans chapeau/);
    }
    expect(Object.keys(octave).filter((name) => /NOHAT|MONO|NOTE_/.test(name))).toEqual([]);
  });

  it("sert la mascotte à partir de 24 px, le glyphe en dessous et pour tout monochrome", () => {
    expect(octaveLogoSvg("color", 48, true)).toBe(OCTAVE_LOGO_SVG);
    expect(octaveLogoSvg("color", 24, false)).toBe(OCTAVE_LOGO_SVG);
    expect(octaveLogoSvg("color", 22, true)).toBe(OCTAVE_GLYPH_SVG);
    expect(octaveLogoSvg("color", 16, false)).toBe(OCTAVE_GLYPH_SVG);
    expect(octaveLogoSvg("mono", 22, true)).toBe(OCTAVE_GLYPH_ON_DARK_SVG);
    expect(octaveLogoSvg("mono", 64, false)).toBe(OCTAVE_GLYPH_ON_LIGHT_SVG);
  });

  it("donne une URI data: autonome", () => {
    expect(octaveLogoDataUri("color", 64, true).startsWith("data:image/svg+xml;charset=utf-8,%3Csvg")).toBe(true);
  });

  it("donne le glyphe de l'interface : des contours fermés, dans le repère du logo", () => {
    expect(OCTAVE_GLYPH_VIEWBOX).toBe("0 0 240 240");
    // Hampe, crochet-bras, tête : trois contours fermés, aucun gabarit resté dedans.
    expect(OCTAVE_GLYPH_PATHS).toHaveLength(3);
    for (const d of OCTAVE_GLYPH_PATHS) {
      expect(d).toMatch(/^M [\d.]+ [\d.]+ /);
      expect(d.trimEnd().endsWith("Z")).toBe(true);
      // La note de l'écran du logo EST le glyphe : mêmes contours.
      expect(OCTAVE_LOGO_SVG).toContain(`d="${d}"`);
    }
  });
});
