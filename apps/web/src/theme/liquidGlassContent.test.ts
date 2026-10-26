/**
 * La couche de CONTENU sous le verre de macOS 26 (lot lg2) : des remplissages,
 * jamais un verre — tenu sur la feuille elle-même.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIR = __dirname;
const CSS = readFileSync(join(DIR, "liquidGlassContent.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const CONTROLS = readFileSync(join(DIR, "../components/ui/glass/lgControls.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const rules = (source: string): Array<[string, string]> =>
  [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => [selector.trim(), body]);

const block = (selector: string): string => rules(CSS).find(([s]) => s === selector)?.[1] ?? "";

/** Contraste WCAG de deux couleurs opaques `#rrggbb`. */
function contrast(a: string, b: string): number {
  const lum = (hex: string): number => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("la couche de contenu", () => {
  it("chaque règle est portée par la porte native", () => {
    for (const [selector] of rules(CSS)) expect(selector).toContain('[data-liquid-glass="native"]');
  });

  it("les jetons locaux existent en sombre ET en clair", () => {
    const dark = block(':root[data-liquid-glass="native"]');
    const light = block(':root[data-liquid-glass="native"][data-theme="light"]');
    for (const name of ["--lgd-fill", "--lgd-fill-hover", "--lgd-stroke", "--lgd-light", "--lgd-raised", "--lgd-control", "--lgd-selected", "--lgd-selected-fg", "--lgd-tab-selected", "--lgd-accent-fg"]) {
      expect(dark).toContain(`${name}:`);
      expect(light).toContain(`${name}:`);
    }
  });

  it("le contenu ne floute rien et ne porte aucune teinte de marque en aplat", () => {
    for (const [, body] of rules(CSS)) {
      expect(body).not.toMatch(/backdrop-filter:(?!\s*none)/);
      expect(body).not.toMatch(/--ctl-gradient|--lgc-fill-prominent|--lg-prominent-gradient/);
    }
  });

  it("les contrôles du contenu (pastilles, champ, segmenté, panneaux) n'ont plus de verre", () => {
    for (const [selector, body] of rules(CONTROLS)) {
      if (!/\.(lg-chip|lg-field|lg-segmented|lg-panel|lg-pill)\b/.test(selector)) continue;
      expect(body, selector).not.toMatch(/var\(--lgc-backdrop\)|var\(--lgc-fill-thick\)/);
    }
  });

  it("les libellés tiennent l'AA sur leurs fonds (replis du thème)", () => {
    // Sombre : libellé d'un filtre actif sur le bouton choisi (blanc 24 % sur
    // la piste, sur le groupe #18181B → #5D5D5E) ; segment choisi des saisons.
    expect(contrast("#ddd6fe", "#5d5d5e")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", "#3a3a3f")).toBeGreaterThanOrEqual(4.5);
    // Clair : accent sur le bouton blanc et sur le gris d'une piste.
    expect(contrast("#6d28d9", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#6d28d9", "#f0f0f4")).toBeGreaterThanOrEqual(4.5);
    // Texte tertiaire du clair (rgba(11, 11, 16, 0.64) sur blanc ≈ #636366).
    expect(contrast("#636366", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#636366", "#f4f4f7")).toBeGreaterThanOrEqual(4.5);
  });
});
