import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { BLACK, WCAG_AA_LARGE, WCAG_AA_TEXT, WHITE, contrastRatio, parseColor, worstGlassContrast, type Rgba } from "./contrast";

const tokens = readFileSync(join(__dirname, "..", "tokens.css"), "utf8");

/** Le jeton existe-t-il dans le bloc de `selector`, en couleur littérale ? */
function hasToken(selector: string, name: string): boolean {
  const start = tokens.indexOf(`${selector} {`);
  if (start < 0) return false;
  const raw = new RegExp(`${name}:\\s*([^;]+);`).exec(tokens.slice(start, tokens.indexOf("\n}", start)))?.[1];
  return raw !== undefined && parseColor(raw) !== null;
}

/** Valeur d'un jeton dans le bloc qui suit `selector` (premier bloc trouvé). */
function tokenIn(selector: string, name: string): Rgba {
  const start = tokens.indexOf(`${selector} {`);
  const block = tokens.slice(start, tokens.indexOf("\n}", start));
  const raw = new RegExp(`${name}:\\s*([^;]+);`).exec(block)?.[1];
  const color = raw ? parseColor(raw) : null;
  if (!color) throw new Error(`${name} introuvable dans ${selector}`);
  return color;
}

describe("contraste — outils", () => {
  it("lit les couleurs CSS courantes", () => {
    expect(parseColor("#fff")).toEqual(WHITE);
    expect(parseColor("rgba(20, 20, 26, 0.6)")).toEqual({ r: 20, g: 20, b: 26, a: 0.6 });
    expect(parseColor("var(--x)")).toBeNull();
  });
  it("donne 21:1 pour noir sur blanc", () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 5);
  });
});

/**
 * Le texte principal du thème posé sur la teinte du verre, au PIRE fond
 * (blanc derrière un verre sombre, noir derrière un verre clair) : AA tenu.
 * Le texte secondaire, réservé aux libellés de taille « grande » ou aux
 * méta-données, tient le seuil des grands textes (3:1).
 */
describe("contraste du texte sur le verre (WCAG AA)", () => {
  for (const [theme, selector] of [
    ["sombre", ":root"],
    ["clair", ':root[data-theme="light"]'],
  ] as const) {
    // La teinte du Liquid Glass (lg-tokens) est tenue au même seuil dès
    // qu'elle existe — et tant qu'elle est une couleur littérale.
    const lgTint = hasToken(selector, "--lg-surface-tint") ? ["--lg-surface-tint"] : [];
    for (const tint of ["--glass-tint", "--glass-tint-strong", ...lgTint]) {
      it(`${theme} : --text-primary sur ${tint} ≥ 4,5`, () => {
        expect(worstGlassContrast(tokenIn(selector, "--text-primary"), tokenIn(selector, tint))).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      });
      it(`${theme} : --text-secondary sur ${tint} ≥ 3`, () => {
        expect(worstGlassContrast(tokenIn(selector, "--text-secondary"), tokenIn(selector, tint))).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
      });
    }
  }
});
