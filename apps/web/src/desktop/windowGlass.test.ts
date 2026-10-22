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

  it("la sélection de la barre latérale lit le remplissage neutre du socle", () => {
    expect(sheet("./windowGlassSidebar.css")).toMatch(/var\(--lg-sidebar-selection,/);
  });
});
