import { describe, expect, it } from "vitest";
import {
  OCTAVE_LOGO_MONO_ON_DARK_NOHAT_SVG,
  OCTAVE_LOGO_MONO_ON_DARK_SVG,
  OCTAVE_LOGO_MONO_ON_LIGHT_NOHAT_SVG,
  OCTAVE_LOGO_MONO_ON_LIGHT_SVG,
  OCTAVE_LOGO_NOHAT_SVG,
  OCTAVE_LOGO_ON_DARK_NOHAT_SVG,
  OCTAVE_LOGO_ON_DARK_SVG,
  OCTAVE_LOGO_SVG,
  OCTAVE_GLYPH_PATHS,
  OCTAVE_GLYPH_VIEWBOX,
  OCTAVE_NOTE_PATHS,
  octaveLogoDataUri,
  octaveLogoSvg,
} from "./octaveLogo.generated";

const ALL = [
  OCTAVE_LOGO_SVG,
  OCTAVE_LOGO_NOHAT_SVG,
  OCTAVE_LOGO_ON_DARK_SVG,
  OCTAVE_LOGO_ON_DARK_NOHAT_SVG,
  OCTAVE_LOGO_MONO_ON_DARK_SVG,
  OCTAVE_LOGO_MONO_ON_LIGHT_SVG,
  OCTAVE_LOGO_MONO_ON_DARK_NOHAT_SVG,
  OCTAVE_LOGO_MONO_ON_LIGHT_NOHAT_SVG,
];

describe("logo d'Octave (module généré par brand/octave.py)", () => {
  it("chaque variante est un SVG vectoriel complet, sans texte ni image", () => {
    for (const svg of ALL) {
      expect(svg.startsWith("<svg ")).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
      expect(svg).toContain('viewBox="0 0 240 240"');
      expect(svg).not.toMatch(/<text|<image|\$\{|data:image\/png/);
    }
  });

  it("sert la variante sans chapeau sous 24 px, la vitre et l'encre selon le fond", () => {
    expect(octaveLogoSvg("color", 16, false)).toBe(OCTAVE_LOGO_NOHAT_SVG);
    expect(octaveLogoSvg("color", 48, false)).toBe(OCTAVE_LOGO_SVG);
    expect(octaveLogoSvg("color", 16, true)).toBe(OCTAVE_LOGO_ON_DARK_NOHAT_SVG);
    expect(octaveLogoSvg("color", 48, true)).toBe(OCTAVE_LOGO_ON_DARK_SVG);
    expect(octaveLogoSvg("mono", 24, true)).toBe(OCTAVE_LOGO_MONO_ON_DARK_SVG);
    expect(octaveLogoSvg("mono", 20, false)).toBe(OCTAVE_LOGO_MONO_ON_LIGHT_NOHAT_SVG);
  });

  it("donne une URI data: autonome et les contours de la note", () => {
    expect(octaveLogoDataUri("color", 64, true).startsWith("data:image/svg+xml;charset=utf-8,%3Csvg")).toBe(true);
    // Deux têtes, deux hampes, une barre.
    expect(OCTAVE_NOTE_PATHS).toHaveLength(5);
  });

  it("donne le glyphe de l'interface : des contours fermés, dans le repère du logo", () => {
    expect(OCTAVE_GLYPH_VIEWBOX).toBe("0 0 240 240");
    // Hampe, crochet-bras, tête : trois contours fermés, aucun gabarit resté dedans.
    expect(OCTAVE_GLYPH_PATHS).toHaveLength(3);
    for (const d of OCTAVE_GLYPH_PATHS) {
      expect(d).toMatch(/^M [\d.]+ [\d.]+ /);
      expect(d.trimEnd().endsWith("Z")).toBe(true);
    }
  });
});
