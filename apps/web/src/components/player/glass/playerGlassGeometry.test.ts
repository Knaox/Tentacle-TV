import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * L'overlay en verre suit la fenêtre et l'écran COMME l'habillage peint par la
 * page (retour de Damien, lot lg3) : mêmes marges, aucune largeur plafonnée. Avant,
 * le bas tenait dans 760 px centrés — en plein écran sur 1920 px, la capsule du
 * temps restait au milieu quand la barre d'avant courait d'un bord à l'autre.
 *
 * Ce test lie les jetons du verre aux marges de l'habillage de la page
 * (`chrome/playerChrome.css`, refonte de nov. 2026) : changer l'un sans l'autre
 * casse ici, pas chez l'utilisateur.
 */

const HERE = __dirname;
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const read = (name: string) => strip(readFileSync(join(HERE, name), "utf8"));

/** La valeur en px d'un jeton déclaré dans `playerGlass.css`. */
function token(name: string): number {
  const match = new RegExp(`${name}:\\s*(\\d+)px`).exec(read("playerGlass.css"));
  if (!match) throw new Error(`jeton ${name} introuvable`);
  return Number(match[1]);
}

/** Le bloc de déclarations d'une classe dans une feuille. */
function rule(file: string, selector: string): string {
  const css = read(file);
  const at = css.indexOf(selector);
  if (at < 0) throw new Error(`${selector} introuvable dans ${file}`);
  return css.slice(css.indexOf("{", at) + 1, css.indexOf("}", at));
}

describe("la géométrie du lecteur en verre suit celle de l'habillage de la page", () => {
  it("mêmes marges : 24 px sur les côtés, 20 px en haut et en bas", () => {
    expect(rule("../chrome/playerChrome.css", ".pl-bar--top {")).toContain("padding: max(20px, env(safe-area-inset-top, 0px)) 24px 44px");
    expect(rule("../chrome/playerChrome.css", ".pl-bar--bottom {")).toContain("padding: 64px 24px max(20px, env(safe-area-inset-bottom, 0px))");
    expect(token("--lg-player-inline")).toBe(24);
    expect(token("--lg-player-edge")).toBe(20);
  });

  it("le haut et le bas tiennent la fenêtre d'une marge à l'autre, sans largeur plafonnée", () => {
    for (const selector of [".lgp-top {", ".lgp-dock {"]) {
      const block = rule("playerGlassBar.css", selector);
      expect(block).toContain("left: var(--lg-player-inline)");
      expect(block).toContain("right: var(--lg-player-inline)");
      expect(block).not.toMatch(/\bwidth:|max-width:|margin-inline:/);
    }
    expect(read("playerGlass.css")).not.toContain("--lg-player-bar-max");
  });

  it("le transport reste au centre de la fenêtre, quelle que soit la largeur des côtés", () => {
    expect(rule("playerGlassCapsules.css", ".lgp-groups {")).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\) auto minmax\(0, 1fr\)/);
  });

  it("les encarts du coin et les panneaux gardent la même marge latérale", () => {
    expect(rule("playerGlassOverlays.css", ".lgp-corner {")).toContain("right: var(--lg-player-inline)");
    expect(rule("../chrome/playerPanels.css", ".pl-panel {")).toContain("right: 24px");
  });
});
