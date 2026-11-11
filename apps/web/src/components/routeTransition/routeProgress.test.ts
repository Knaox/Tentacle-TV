import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (path: string): string => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const bare = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Le bloc de déclarations d'un sélecteur (première occurrence). */
function block(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`sélecteur absent : ${selector}`);
  return css.slice(start, css.indexOf("}", start));
}

describe("la barre fine d'attente (RouteProgress)", () => {
  const sheet = bare(read("./routeProgress.css"));

  it("se pose sous le bandeau de fenêtre du bureau, pas derrière lui", () => {
    // Le bandeau (`HostTitleBar`) est opaque, en haut de la fenêtre, au-dessus de tout (z 10000) :
    // une barre collée à `top: 0` y disparaissait entièrement.
    expect(block(sheet, ".route-progress")).toContain("inset: var(--hote-bandeau, 0px) 0 auto;");
  });

  it("hors du bureau, le bandeau vaut 0 px : la barre reste au haut de la page", () => {
    // Le repli de `index.css` : sans lui, un `calc()` ou un `inset` sur une variable absente tombe.
    expect(bare(read("../../index.css"))).toMatch(/:root\s*\{\s*--hote-bandeau:\s*0px;/);
  });

  it("ne bouge que sur le compositeur : opacité de la barre, échelle de sa jauge", () => {
    const animated = [...sheet.matchAll(/@keyframes [\w-]+ \{([\s\S]*?)\n\}/g)].map((m) => m[1] ?? "").join("\n");
    const properties = [...animated.matchAll(/^\s+([a-z-]+):/gm)].map((m) => m[1]);
    expect(new Set(properties)).toEqual(new Set(["opacity", "transform"]));
  });
});
