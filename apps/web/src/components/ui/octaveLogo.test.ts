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
  OCTAVE_LOGO_SMALL_SVG,
  OCTAVE_LOGO_SVG,
  octaveLogoDataUri,
  octaveLogoSvg,
} from "./octaveLogo.generated";

/** Les SVG que `brand/octave.py` écrit, que le module doit reprendre à l'identique. */
const BRAND = resolve(__dirname, "../../../../../brand/octave");
const FILES: Record<string, string> = {
  "logo-octave.svg": OCTAVE_LOGO_SVG,
  "logo-octave-small.svg": OCTAVE_LOGO_SMALL_SVG,
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

  it("la mascotte porte le tricorne de Tentacle, à toutes les tailles", () => {
    const tentacle = readFileSync(resolve(BRAND, "../logo-color.svg"), "utf8");
    // La calotte du logo de toujours, au même endroit (même chemin, même repère).
    const hat = /<g transform="([^"]+)"><path d="([^"]+)" fill="url\(#gH\)"/.exec(tentacle);
    expect(hat).not.toBeNull();
    for (const svg of [OCTAVE_LOGO_SVG, OCTAVE_LOGO_SMALL_SVG]) {
      expect(svg).toContain(`<g transform="${hat?.[1]}"><path d="${hat?.[2]}" fill="url(#gH)"`);
    }
    // Le glyphe et le monochrome n'ont pas de mascotte, donc pas de chapeau ; ni l'ancien masque.
    for (const svg of [OCTAVE_GLYPH_SVG, OCTAVE_GLYPH_ON_DARK_SVG, OCTAVE_GLYPH_ON_LIGHT_SVG]) {
      expect(svg).not.toMatch(/url\(#gH\)|mOct/);
    }
    expect(Object.keys(octave).filter((name) => /NOHAT|MONO|NOTE_/.test(name))).toEqual([]);
  });

  it("sous 24 px, le tricorne est cerné (il se lit sur l'encre) et les ventouses s'effacent", () => {
    expect(OCTAVE_LOGO_SMALL_SVG).toMatch(/fill="url\(#gH\)" stroke="url\(#gV\)" stroke-width="\d+" stroke-linejoin="round" paint-order="stroke"/);
    expect(OCTAVE_LOGO_SVG).not.toContain('paint-order="stroke"');
    // Les ventouses : le groupe à l'opacité des ventouses du logo.
    expect(OCTAVE_LOGO_SVG).toMatch(/<g fill="#FBCFE8" opacity="\.8">/);
    expect(OCTAVE_LOGO_SMALL_SVG).not.toContain("#FBCFE8");
  });

  it("sert la mascotte à toute taille (sa petite taille sous 24 px), le glyphe pour tout monochrome", () => {
    expect(octaveLogoSvg("color", 48, true)).toBe(OCTAVE_LOGO_SVG);
    expect(octaveLogoSvg("color", 24, false)).toBe(OCTAVE_LOGO_SVG);
    expect(octaveLogoSvg("color", 22, true)).toBe(OCTAVE_LOGO_SMALL_SVG);
    expect(octaveLogoSvg("color", 16, false)).toBe(OCTAVE_LOGO_SMALL_SVG);
    expect(octaveLogoSvg("mono", 22, true)).toBe(OCTAVE_GLYPH_ON_DARK_SVG);
    expect(octaveLogoSvg("mono", 64, false)).toBe(OCTAVE_GLYPH_ON_LIGHT_SVG);
  });

  it("donne une URI data: autonome", () => {
    expect(octaveLogoDataUri("color", 64, true).startsWith("data:image/svg+xml;charset=utf-8,%3Csvg")).toBe(true);
  });

  it("donne le glyphe de l'interface : des contours fermés, dans le repère du logo", () => {
    expect(OCTAVE_GLYPH_VIEWBOX).toBe("0 0 240 240");
    for (const d of OCTAVE_GLYPH_PATHS) {
      expect(d).toMatch(/^M [\d.]+ [\d.]+ /);
      expect(d.trimEnd().endsWith("Z")).toBe(true);
      // La note de l'écran du logo EST le glyphe : mêmes contours.
      expect(OCTAVE_LOGO_SVG).toContain(`d="${d}"`);
    }
  });

  // Défaut O1-1 : trois tracés superposés, remplis d'une couleur translucide (l'entrée de la
  // barre, le verre), composaient leur alpha trois fois sur la jonction hampe-tête.
  it("une couleur translucide ne se cumule jamais : le glyphe est UN tracé, sous-tracés du même sens", () => {
    expect(OCTAVE_GLYPH_PATHS).toHaveLength(1);
    for (const svg of [OCTAVE_GLYPH_SVG, OCTAVE_GLYPH_ON_DARK_SVG, OCTAVE_GLYPH_ON_LIGHT_SVG]) {
      expect(svg.match(/<path /g)).toHaveLength(1);
    }
    // Hampe, crochet, tête : trois sous-tracés, tous antihoraires à l'écran — avec `nonzero`,
    // un recouvrement vaut +1 +1 (rempli), jamais +1 −1 (un trou).
    const subpaths = OCTAVE_GLYPH_PATHS[0].split(/(?=M )/);
    expect(subpaths).toHaveLength(3);
    for (const sub of subpaths) {
      if (sub.includes("A ")) {
        // Les arcs de la tête : « grand arc » 1, sens 0 (antihoraire à l'écran).
        expect([...sub.matchAll(/A [\d.]+ [\d.]+ -?[\d.]+ (\d) (\d)/g)].map((m) => `${m[1]}${m[2]}`)).toEqual(["10", "10"]);
        continue;
      }
      const nums = (sub.match(/-?[\d.]+/g) ?? []).map(Number);
      const points = nums.flatMap((_, i) => (i % 2 === 0 ? [[nums[i], nums[i + 1]] as const] : []));
      const area = points.reduce((sum, [x0, y0], i) => {
        const [x1, y1] = points[(i + 1) % points.length];
        return sum + x0 * y1 - x1 * y0;
      }, 0);
      expect(area).toBeLessThan(0);
    }
  });
});
