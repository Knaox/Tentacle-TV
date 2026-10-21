import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { windowGlassActive } from "./windowGlass";

const sheet = (name: string) => readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");

/** Les sélecteurs d'une feuille, commentaires et blocs `@media` ôtés. */
function selectors(css: string): string[] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: string[] = [];
  for (const match of bare.matchAll(/([^{};]+)\{/g)) {
    const head = (match[1] ?? "").trim();
    if (head.startsWith("@")) continue;
    for (const part of head.split(",")) out.push(part.trim());
  }
  return out;
}

const GATE = ':root[data-liquid-glass="native"]';

describe("verre de fenêtre", () => {
  it("reste fermé hors de la coquille macOS (web, tests)", () => {
    expect(windowGlassActive()).toBe(false);
  });

  for (const name of ["./windowGlass.css", "./windowGlassNav.css"]) {
    it(`${name} : aucune règle hors de la garde — rendu d'avant au pixel près`, () => {
      const list = selectors(sheet(name));
      expect(list.length).toBeGreaterThan(5);
      // Plus strict que le test du lot : même une règle qui ne lit aucun jeton.
      const loose = list.filter((s) => !s.startsWith(GATE));
      expect(loose).toEqual([]);
    });
  }
});
