/**
 * Le Liquid Glass d'Octave change le MATÉRIAU, jamais les DIMENSIONS (Damien,
 * 26/10 : « pourquoi tout paraît énorme en mode Liquid Glass »). Les feuilles du
 * verre d'Octave ne posent donc aucune taille, marge, police ni position : en
 * natif, chaque boîte reste celle du mode normal (vérifié au banc : 7 pages ×
 * 2 thèmes, boîtes identiques à 1 px près).
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FILES = [
  ...readdirSync(__dirname).filter((f) => f.endsWith(".css")).map((f) => join(__dirname, f)),
  join(__dirname, "../shell/shellGlass.css"),
];

/** Les propriétés qui changent une boîte (ou sa place). */
const SIZING = /^(width|height|min-width|min-height|max-width|max-height|padding(-\w+)?|margin(-\w+)?|gap|row-gap|column-gap|font-size|line-height|letter-spacing|top|right|bottom|left|inset|flex(-\w+)?|grid(-\w+)?|border(-(top|right|bottom|left))?-width|transform|zoom|scale)$/;
/** Un jeton de taille d'Octave redéfini (`--oc-dock-height`, `--oc-sidebar-width`, `--oc-rail-height`…). */
const SIZING_TOKEN = /^--oc-[\w-]*(height|width|size|inset|gap|max)$/;

function declarations(css: string): { property: string; value: string }[] {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...body.matchAll(/([\w-]+)\s*:\s*([^;{}]+);/g)].map((m) => ({ property: m[1] ?? "", value: (m[2] ?? "").trim() }));
}

describe("le verre d'Octave ne pose que de la peau", () => {
  it.each(FILES)("%s : aucune taille, marge, police ni position", (file) => {
    const offending = declarations(readFileSync(file, "utf8")).filter(({ property, value }) => {
      // Un bord RETIRÉ (0) compense le bord d'une pastille du socle sur un contrôle qui n'en avait pas : la boîte ne bouge pas.
      if (property === "border-width" && value === "0") return false;
      return SIZING.test(property) || SIZING_TOKEN.test(property);
    });
    expect(offending).toEqual([]);
  });
});
