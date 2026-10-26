/**
 * Octave en verre natif (`shellGlass.css`, D11 du 26/10) : le verre est pour
 * ce qui FLOTTE. Le dock garde un verre clair dont le texte se lit sur TOUT
 * dessous ; le rail reste posé sur l'encre, sans surface de verre.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compositeOver, contrastRatio, parseColor, WCAG_AA_LARGE, WCAG_AA_TEXT, WHITE, type Rgba } from "../../../theme/glass/contrast";

const CSS = readFileSync(join(__dirname, "shellGlass.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const SIDEBAR = readFileSync(join(__dirname, "OctaveSidebar.tsx"), "utf8");

/** L'encre du dock (le dernier aplat `rgba(…)` de `--lg-surface-fill`) dans le bloc dont le sélecteur contient `marker`. */
function dockInk(marker: string): Rgba {
  const block = CSS.split("}").find((b) => b.includes(marker) && b.includes("--lg-surface-fill"));
  const fill = /--lg-surface-fill:([^;]+);/.exec(block ?? "")?.[1] ?? "";
  const colors = [...fill.matchAll(/rgba\([^)]+\)/g)].map((m) => m[0]);
  const ink = parseColor(colors.at(-1) ?? "");
  if (!ink) throw new Error(`encre du dock introuvable : ${marker}`);
  return ink;
}

describe("le dock d'Octave en verre natif", () => {
  // Le pire dessous : un blanc pur (ni le fondu de la page, ni le reflet ne sont comptés).
  it.each([
    ["sombre", '[data-lg-tone="dark"]'],
    ["clair", ':root[data-theme="light"]'],
  ])("thème %s : le texte blanc tient l'AA sur un dessous blanc pur", (_theme, marker) => {
    const surface = compositeOver(dockInk(marker), WHITE);
    expect(contrastRatio(WHITE, surface)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    const secondary = compositeOver({ r: 255, g: 255, b: 255, a: 0.8 }, surface);
    expect(contrastRatio(secondary, surface)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
  });

  it("n'a ni liseré ni givre éteint : la forme est dite par le biseau, les pochettes gardent leur couleur", () => {
    const dock = CSS.split("}").find((b) => b.includes(".octave-night.octave-glass.lg-surface")) ?? "";
    expect(dock).toMatch(/--lg-edge:\s*transparent/);
    const saturate = Number(/--lg-saturate:\s*([\d.]+)/.exec(dock)?.[1]);
    expect(saturate).toBeGreaterThanOrEqual(1);
  });
});

describe("le rail d'Octave", () => {
  it("n'est jamais une surface de verre : posé sur l'encre, sans démarcation", () => {
    expect(SIDEBAR).not.toMatch(/useLiquidGlassSurface|octave-glass/);
    expect(CSS).not.toMatch(/octave-rail/);
  });
});
