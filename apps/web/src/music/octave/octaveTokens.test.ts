/**
 * Les jetons de l'identité d'Octave (`octaveTokens.css`) : présents en sombre,
 * redits en clair pour ce qui porte la couleur, tirés des jetons de Tentacle,
 * et sûrs pour la garde du client LG (qui compile aussi ce module paresseux).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIR = __dirname;
const TOKENS = readFileSync(join(DIR, "octaveTokens.css"), "utf8");

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
  new Set(Array.from(block.matchAll(/^\s*(--oc-[a-z0-9-]+)\s*:/gim), (m) => m[1] as string));

const DARK = declared(blockFor(TOKENS, ":root"));
const LIGHT = declared(blockFor(TOKENS, ':root[data-theme="light"]'));

/** Les feuilles d'Octave (la coquille, les vues, la recherche…). */
function cssFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) cssFiles(path, out);
    else if (name.endsWith(".css")) out.push(path);
  }
  return out;
}

describe("les jetons d'Octave", () => {
  it("le socle de l'identité est déclaré", () => {
    for (const name of [
      "--oc-ink",
      "--oc-ink-raised",
      "--oc-accent",
      "--oc-accent-rgb",
      "--oc-accent-text",
      "--oc-accent-soft",
      "--oc-gradient",
      "--oc-gradient-deep",
      "--oc-progress-fill",
      "--oc-volume-fill",
      "--oc-thumb",
      "--oc-dock-bg",
      "--oc-nav-active-bg",
      "--oc-radius-art",
      "--oc-radius-dock",
      "--oc-shadow-art",
      "--oc-ease-out",
      "--oc-duration",
    ]) {
      expect(DARK, name).toContain(name);
    }
  });

  it("le clair redit ce qui porte la couleur, et rien que le sombre n'ait pas", () => {
    for (const name of ["--oc-ink-raised", "--oc-accent-text", "--oc-dock-bg", "--oc-dock-shadow", "--oc-thumb", "--oc-nav-active-bg"]) {
      expect(LIGHT, name).toContain(name);
    }
    for (const name of LIGHT) expect(DARK, name).toContain(name);
  });

  it("l'accent est le ROSE de la marque, jamais une valeur en dur", () => {
    const dark = blockFor(TOKENS, ":root");
    expect(dark).toMatch(/--oc-accent:\s*var\(--brand-accent\);/);
    expect(dark).toMatch(/--oc-accent-rgb:\s*var\(--brand-accent-rgb\);/);
    expect(dark).toMatch(/--oc-volume-fill:\s*var\(--oc-accent\);/);
  });

  it("tout jeton lu dans une feuille d'Octave y est déclaré", () => {
    for (const file of cssFiles(DIR)) {
      for (const [, name] of readFileSync(file, "utf8").matchAll(/var\((--oc-[a-z0-9-]+)/g)) {
        expect(DARK, `${file.slice(DIR.length)} → ${name}`).toContain(name);
      }
    }
  });

  it("aucune primitive que la feuille du téléviseur LG refuserait", () => {
    for (const file of cssFiles(DIR)) {
      const source = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(source, file).not.toMatch(/\b(min|max|clamp|color-mix)\(/);
      expect(source, file).not.toMatch(/:(is|where|has)\(/);
    }
  });

  it("chargés AVANT les règles de la coquille qui les lisent", () => {
    const octave = readFileSync(join(DIR, "octave.css"), "utf8");
    expect(octave.trimStart().startsWith('@import "./octaveTokens.css";')).toBe(true);
  });
});
