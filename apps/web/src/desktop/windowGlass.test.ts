import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { windowGlassActive } from "./windowGlass";

const sheet = (name: string) => readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");

/** Les virgules de PREMIER niveau seulement : celles de `:is(a, b)` restent. */
function splitTopLevel(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of list) {
    if (char === "(") depth++;
    else if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else current += char;
  }
  parts.push(current);
  return parts;
}

/** Les sélecteurs d'une feuille, commentaires et blocs `@media` ôtés. */
function selectors(css: string): string[] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: string[] = [];
  for (const match of bare.matchAll(/([^{};]+)\{/g)) {
    const head = (match[1] ?? "").trim();
    if (head.startsWith("@")) continue;
    for (const part of splitTopLevel(head)) out.push(part.trim());
  }
  return out;
}

const GATE = ':root[data-liquid-glass="native"]';

describe("verre de fenêtre", () => {
  it("reste fermé hors de la coquille macOS (web, tests)", () => {
    expect(windowGlassActive()).toBe(false);
  });

  for (const name of ["./windowGlass.css", "./windowGlassNav.css", "./windowGlassSidebar.css"]) {
    it(`${name} : aucune règle hors de la garde — rendu d'avant au pixel près`, () => {
      const list = selectors(sheet(name));
      expect(list.length).toBeGreaterThan(5);
      // Plus strict que le test du lot : même une règle qui ne lit aucun jeton.
      const loose = list.filter((s) => !s.startsWith(GATE));
      expect(loose).toEqual([]);
    });

    // La marque est une emphase (action principale d'un écran), jamais une
    // sélection de barre ni de barre latérale (lot lg2, règle 5 d'Apple).
    it(`${name} : aucun dégradé de marque`, () => {
      const bare = sheet(name).replace(/\/\*[\s\S]*?\*\//g, "");
      expect(bare).not.toMatch(/--lg-tint-gradient|--lg-tint-brand|--brand-accent/);
    });
  }

  it("la barre latérale et la barre du haut prennent le verre de la maquette (sélection, survol)", () => {
    const sidebar = sheet("./windowGlassSidebar.css");
    expect(sidebar).toMatch(/\.lgc-sidebar\.lgc-sidebar-plate\s*\{[^}]*--lg-chrome-sidebar-selection-bg:\s*var\(--lg-pane-selected\)/);
    expect(sidebar).toMatch(/--lg-chrome-item-hover:\s*var\(--lg-pane-nav-hover\)/);
    expect(sheet("./windowGlassNav.css")).toMatch(/--lg-chrome-lens-bg:\s*var\(--lg-pane-selected\)/);
  });

  // Damien, 26/10 : « pourquoi tout paraît énorme en mode Liquid Glass » — le
  // verre change le MATÉRIAU, jamais les DIMENSIONS. Aucune feuille de la
  // fenêtre ne touche une taille, une marge, un espacement ou une typographie
  // (le banc des boîtes le vérifie page par page, `pret/D12.md`).
  it("aucune dimension : ni taille, ni marge, ni espacement, ni corps de texte", () => {
    const LAYOUT = /^\s*(height|min-height|max-height|width|min-width|max-width|padding(-[a-z]+)?|margin(-[a-z]+)?|gap|row-gap|column-gap|font-size|line-height|letter-spacing|font-weight|text-transform|top|right|bottom|left|display|flex(-[a-z]+)?)\s*:/m;
    for (const name of ["./windowGlass.css", "./windowGlassNav.css", "./windowGlassSidebar.css"]) {
      const bare = sheet(name).replace(/\/\*[\s\S]*?\*\//g, "");
      for (const match of bare.matchAll(/([^{};]+)\{([^{}]*)\}/g)) {
        const [, selector, body] = match;
        // Les calques (effet de bord, pseudo-éléments de la plaque) se posent PAR-DESSUS : ils n'ont aucune boîte de contenu.
        if (/::(before|after)|\.lgc-edge/.test(selector ?? "")) continue;
        expect(body, `${name} ${selector?.trim()}`).not.toMatch(LAYOUT);
      }
    }
  });
});
