/**
 * Le bouton de lecture des héros : son dégradé tient un libellé blanc en AA
 * (4,5:1) d'un bout à l'autre, dans les DEUX thèmes — mesuré sur les jetons
 * réels de `tokens.css` —, et sa classe reste visée par le focus d'entrée du
 * client des TV LG.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { minContrastOnGradient } from "@tentacle-tv/theme";

const TOKENS = readFileSync(join(__dirname, "tokens.css"), "utf8");
const HERO_CSS = readFileSync(join(__dirname, "heroCta.css"), "utf8");
// Lu comme du texte : importer le composant monterait toute l'app (window).
const HERO_ACTIONS = readFileSync(join(__dirname, "../components/hero/HeroActions.tsx"), "utf8");

/** La valeur hex d'une variable dans le bloc qui commence par `selector`. */
function token(selector: string, name: string): string {
  const start = TOKENS.indexOf(`${selector} {`);
  const block = TOKENS.slice(start, TOKENS.indexOf("\n}", start));
  const match = new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6});`).exec(block);
  if (!match) throw new Error(`${name} absent de ${selector}`);
  return match[1];
}

describe("bouton de lecture des héros", () => {
  it("le dégradé part de --brand-dark et finit sur --brand-accent-dark", () => {
    expect(TOKENS).toMatch(/--cta-brand-gradient: linear-gradient\(120deg, var\(--brand-dark\) 0%, var\(--brand-accent-dark\) 100%\)/);
    expect(HERO_CSS).toMatch(/background-image: var\(--cta-brand-gradient\)/);
  });

  it.each([":root", ':root[data-theme="light"]'])("libellé blanc ≥ 4,5:1 sur tout le dégradé (%s)", (selector) => {
    const from = token(selector, "--brand-dark");
    const to = token(selector, "--brand-accent-dark");
    expect(minContrastOnGradient("#FFFFFF", from, to)).toBeGreaterThanOrEqual(4.5);
  });

  it("le focus d'entrée des TV LG le trouve toujours (`[class*=\"cta-primary\"]`)", () => {
    const playClass = /export const HERO_PLAY_CLASS =\s*"([^"]+)"/.exec(HERO_ACTIONS)?.[1] ?? "";
    expect(playClass).toContain("hero-cta-primary");
    expect(playClass).toContain("cta-primary");
  });
});
