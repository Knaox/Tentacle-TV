/**
 * Octave en verre natif (`shellGlass.css`) : le dock est le verre `pane` du
 * socle, ton sombre forcé, avec une encre plus dense — il flotte au-dessus de
 * la PAGE qui défile, pas du seul fond ambiant que couvre la preuve du socle.
 * Le texte s'y lit sur TOUT dessous, un blanc pur compris. Le rail est un
 * panneau de verre posé sur le fond coloré d'Octave (maquette « Octave ·
 * Playlist », D13 du 26/10).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compositeOver, contrastRatio, parseColor, WCAG_AA_LARGE, WCAG_AA_TEXT, WHITE, type Rgba } from "../../../theme/glass/contrast";
import { PANE_DARK, paneColorOver, sheenCorner } from "../../../theme/glass/paneMaterial";

const CSS = readFileSync(join(__dirname, "shellGlass.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const SIDEBAR = readFileSync(join(__dirname, "OctaveSidebar.tsx"), "utf8");
const PLAYER_BAR = readFileSync(join(__dirname, "PlayerBar.tsx"), "utf8");

/** L'encre du dock (`--lg-pane-ink`) dans le bloc dont le sélecteur contient `marker`. */
function dockInk(marker: string): Rgba {
  const block = CSS.split("}").find((b) => b.includes(marker) && b.includes("--lg-pane-ink"));
  const ink = parseColor(/--lg-pane-ink:\s*([^;]+);/.exec(block ?? "")?.[1]?.trim() ?? "");
  if (!ink) throw new Error(`encre du dock introuvable : ${marker}`);
  return ink;
}

describe("le dock d'Octave en verre natif", () => {
  it("est le verre de la maquette (matériau `pane`), ton sombre forcé", () => {
    expect(PLAYER_BAR).toMatch(/material: "pane",\s*tone: "dark"/);
  });

  // Le pire dessous : un blanc pur (une pochette blanche qui passe sous le dock).
  it.each([
    ["sombre", ':root[data-liquid-glass="native"] .octave-night.lg-pane'],
    ["clair", '[data-theme="light"] .octave-night.lg-pane'],
  ])("thème %s : le texte blanc tient l'AA sur un dessous blanc pur", (_theme, marker) => {
    const tone = { ...PANE_DARK, ink: dockInk(marker) };
    // Le corps du verre, au plus fort de son dégradé blanc.
    const body = paneColorOver(WHITE, tone, tone.fillPeak);
    expect(contrastRatio(WHITE, body)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    const secondary = compositeOver({ r: 255, g: 255, b: 255, a: 0.72 }, body);
    expect(contrastRatio(secondary, body)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
    // Le coin du reflet : grand texte, icônes.
    const corner = paneColorOver(WHITE, tone, sheenCorner(tone));
    expect(contrastRatio(WHITE, corner)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
  });
});

describe("le rail d'Octave", () => {
  it("garde sa boîte du mode normal : aucune surface de verre, seule la peau de ses entrées change", () => {
    expect(SIDEBAR).not.toMatch(/useLiquidGlassSurface/);
    expect(SIDEBAR).toMatch(/className="flex h-full w-\[var\(--oc-sidebar-width\)\] shrink-0 flex-col gap-5 px-3 pb-3 pt-4"/);
    expect(SIDEBAR).toMatch(/lg-pane-nav/);
  });
});
