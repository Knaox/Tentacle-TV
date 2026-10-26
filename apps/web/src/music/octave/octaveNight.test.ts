/**
 * La nuit d'Octave (`octaveNight.css`) : la barre de lecture reste SOMBRE dans
 * les deux thèmes (« jamais une barre blanche »). En thème clair, la surface
 * de nuit reprend les couleurs de base du thème sombre de Tentacle : recopiées,
 * elles ne doivent jamais diverger de `theme/tokens.css`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const NIGHT = readFileSync(join(__dirname, "octaveNight.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const OCTAVE = readFileSync(join(__dirname, "octaveTokens.css"), "utf8");
const TENTACLE = readFileSync(join(__dirname, "../../theme/tokens.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function blockFor(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Bloc introuvable : ${selector}`);
  const from = source.indexOf("{", start);
  const end = source.indexOf("}", from);
  return source.slice(from + 1, end);
}

/** Les déclarations `--nom: valeur` d'un bloc ; la dernière l'emporte (repli littéral puis calculé). */
function declarations(block: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [, name, value] of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) out.set(name as string, (value as string).trim());
  return out;
}

const night = declarations(blockFor(NIGHT, ':root[data-theme="light"] .octave-night'));
const tentacleDark = declarations(blockFor(TENTACLE, ":root"));

describe("la nuit d'Octave", () => {
  it("le dock et le mini-lecteur sont des surfaces de nuit", () => {
    const bar = readFileSync(join(__dirname, "shell/PlayerBar.tsx"), "utf8");
    expect(bar.match(/"octave-night /g)?.length).toBe(2);
    // Le verre natif (le `pane` du socle) : ton FORCÉ à sombre, quel que soit le dessous.
    expect(bar.match(/material: "pane",\s*tone: "dark"/g)?.length).toBe(2);
  });

  it("les jetons d'Octave du thème sombre se recalculent sur la nuit", () => {
    expect(OCTAVE).toMatch(/:root,\s*\.octave-night\s*\{/);
  });

  it("les couleurs de base recopiées sont celles du thème sombre de Tentacle, à l'identique", () => {
    const copied = ["--surface-0", "--text-primary", "--text-secondary", "--text-tertiary", "--text-quaternary", "--border-subtle", "--fill-medium", "--brand", "--brand-rgb", "--brand-accent", "--brand-accent-rgb", "--brand-accent-light", "--status-error-fg"];
    for (const name of copied) expect(night.has(name), name).toBe(true);
    for (const [name, value] of night) {
      if (name.startsWith("--oc-")) continue;
      // Les jetons dérivés sont redéclarés avec la MÊME expression que Tentacle.
      expect(value.toLowerCase(), name).toBe((tentacleDark.get(name) ?? "absent de tokens.css").toLowerCase());
    }
  });

  it("au-dessus d'une page claire, le verre de nuit reste encre (≥ 0,85 d'opacité)", () => {
    const bg = night.get("--oc-dock-bg") ?? "";
    const alpha = Number(/rgba\([^)]*,\s*([0-9.]+)\)/.exec(bg)?.[1]);
    expect(alpha).toBeGreaterThanOrEqual(0.85);
  });

  it("en clair, un panneau d'Octave n'est jamais blanc pur", () => {
    const light = declarations(blockFor(OCTAVE, ':root[data-theme="light"]'));
    expect(light.get("--oc-ink-raised")?.toLowerCase()).not.toMatch(/^#(fff|ffffff)$/);
  });
});
