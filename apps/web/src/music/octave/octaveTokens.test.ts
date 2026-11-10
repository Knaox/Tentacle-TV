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

// Le thème sombre vaut aussi pour la nuit (`:root, .octave-night`).
const DARK = declared(blockFor(TOKENS, ".octave-night"));
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
      "--oc-ink-menu",
      "--oc-radius-menu",
      "--oc-shadow-menu",
      "--oc-ease-out",
      "--oc-duration",
    ]) {
      expect(DARK, name).toContain(name);
    }
  });

  it("le clair ne redit que ce que le socle ne règle pas seul, et rien que le sombre n'ait pas", () => {
    // L'accent, les remplissages, la jauge suivent le thème par les jetons du socle : seuls l'encre de panneau et les ombres se redisent.
    for (const name of ["--oc-ink-raised", "--oc-ink-raised-rgb", "--oc-shadow-art", "--oc-shadow-art-lg"]) {
      expect(LIGHT, name).toContain(name);
    }
    for (const name of LIGHT) expect(DARK, name).toContain(name);
  });

  it("l'accent est la teinte franche du socle (un état ACTIF), jamais une valeur en dur", () => {
    const dark = blockFor(TOKENS, ".octave-night");
    expect(dark).toMatch(/--oc-accent:\s*var\(--accent\);/);
    expect(dark).toMatch(/--oc-accent-rgb:\s*var\(--accent-rgb\);/);
    expect(dark).toMatch(/--oc-accent-text:\s*var\(--accent\);/);
    // Le volume reste d'UNE teinte (Damien, 25/10 : « pas violet ») ; le dégradé de jauge est à la progression.
    expect(dark).toMatch(/--oc-volume-fill:\s*var\(--oc-accent\);/);
    expect(dark).toMatch(/--oc-progress-fill:\s*var\(--oc-gradient\);/);
    expect(dark).toMatch(/--oc-gradient:\s*var\(--gauge-gradient\);/);
  });

  it("refonte de nov. 2026 : le dégradé ne sert qu'à lire et à mesurer, l'encre est neutre", () => {
    const dark = blockFor(TOKENS, ".octave-night");
    // Lire : le dégradé du logo sous le bouton Lecture. Mesurer : la jauge. Rien d'autre.
    expect(dark).toMatch(/--oc-gradient-deep:\s*var\(--cta-brand-gradient\);/);
    // L'entrée active du rail est une pastille NEUTRE, la tête d'une vue n'a plus de voile de marque.
    expect(dark).toMatch(/--oc-nav-active-bg:\s*var\(--fill-soft\);/);
    expect(dark).toMatch(/--oc-hero-veil:\s*none;/);
    // Aucun dégradé écrit dans les jetons, aucune couleur de marque lue pour décorer.
    const bare = TOKENS.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(bare).not.toMatch(/gradient\(/);
    expect(bare).not.toMatch(/var\(--brand/);
    // L'encre de panneau est celle du socle (#131315), plus la prune.
    expect(dark).toMatch(/--oc-ink-raised:\s*#131315;/);
    expect(dark).not.toMatch(/#0e0b13/i);
  });

  it("aucun dégradé de marque dans les feuilles d'Octave hors de la lecture et de la jauge", () => {
    for (const file of cssFiles(DIR)) {
      // La nuit RECOPIE les deux dégradés du socle (lecture, jauge), à l'identique : `octaveNight.test.ts` la tient.
      if (file.endsWith("octaveNight.css")) continue;
      const source = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      // Les seuls dégradés permis : la teinte de la POCHETTE (lavis de tête, océan), les fondus d'encre et de lumière.
      for (const [gradient] of source.matchAll(/(?:linear|radial)-gradient\([^;]*;/g)) {
        expect(gradient, file).not.toMatch(/--brand/);
      }
    }
  });

  it("tout jeton lu dans une feuille d'Octave y est déclaré", () => {
    // Posées en ligne par un composant, à chaque valeur (la tête d'une glissière).
    const runtime = new Set(["--oc-at"]);
    for (const file of cssFiles(DIR)) {
      for (const [, name] of readFileSync(file, "utf8").matchAll(/var\((--oc-[a-z0-9-]+)/g)) {
        if (runtime.has(name as string)) continue;
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
