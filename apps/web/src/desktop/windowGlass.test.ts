import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { windowGlassActive, windowGlassSupported } from "./windowGlass";

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

// L'effet de bord n'existe que monté par `HostTitleBar`, porte ouverte :
// ses règles nues ne touchent aucun élément ailleurs.
const MOUNTED_ONLY_UNDER_GATE = /^(\.lgc-edge|:root\[data-lg-toolbar="nav"\] \.lgc-edge)/;

describe("verre de fenêtre", () => {
  it("reste fermé hors de la coquille macOS (web, tests)", () => {
    expect(windowGlassSupported()).toBe(false);
    expect(windowGlassActive()).toBe(false);
  });

  for (const name of ["./windowGlass.css", "./windowGlassNav.css"]) {
    it(`${name} : aucune règle hors de la garde — rendu d'avant au pixel près`, () => {
      const list = selectors(sheet(name));
      expect(list.length).toBeGreaterThan(5);
      const loose = list.filter(
        (s) => !s.startsWith(':root[data-lg-chrome="on"]') && !MOUNTED_ONLY_UNDER_GATE.test(s),
      );
      expect(loose).toEqual([]);
    });
  }
});
