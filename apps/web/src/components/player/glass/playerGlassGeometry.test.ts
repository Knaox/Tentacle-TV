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

  it("la rangée est celle de l'habillage sans verre : mêmes écarts, la barre d'une marge à l'autre", () => {
    expect(rule("../chrome/playerChrome.css", ".pl-bar--bottom {")).toContain("gap: 10px");
    expect(rule("../chrome/playerChrome.css", ".pl-row {")).toContain("gap: 10px");
    expect(token("--lg-player-row-gap")).toBe(10);
    expect(rule("playerGlassCapsules.css", ".lgp-row {")).toMatch(/gap: var\(--lg-player-row-gap\)[\s\S]*margin-top: var\(--lg-player-row-gap\)/);
    // La zone de saisie de la barre : 18 px, comme `.pl-seek`.
    expect(rule("../chrome/playerSeek.css", ".pl-seek {")).toContain("height: 18px");
    expect(token("--lg-player-timeline-height")).toBe(18);
    // Plus de transport centré ni de grille à trois colonnes : la disposition du verre d'avant.
    expect(read("playerGlassCapsules.css")).not.toMatch(/grid-template-columns|lgp-groups|lgp-cluster/);
  });

  it("une capsule de verre a la boîte de la capsule d'encre : 50 px, boutons de 40, 2 px entre eux, 5 au bord", () => {
    const caps = rule("../chrome/playerChrome.css", ".pl-caps {");
    expect(caps).toContain("height: 50px");
    expect(caps).toContain("padding: 0 5px");
    expect(caps).toContain("gap: 2px");
    const button = rule("../chrome/playerChrome.css", ".pl-btn {");
    expect(button).toContain("width: 40px");
    expect(button).toContain("height: 40px");
    expect(rule("../chrome/playerChrome.css", "\n.pl-btn--solo {")).toContain("width: 44px");
    expect(token("--lg-player-caps-height")).toBe(50);
    expect(token("--lg-player-caps-pad")).toBe(5);
    expect(token("--lg-player-caps-gap")).toBe(2);
    expect(token("--lg-player-caps-button")).toBe(40);
    expect(token("--lg-player-orb")).toBe(44);
  });

  it("le curseur du volume a la place de celui d'avant : 84 px, dans la capsule de droite", () => {
    const legacy = rule("../chrome/playerSeek.css", ".pl-volume__range {");
    expect(legacy).toContain("width: 84px");
    expect(legacy).toContain("margin: 0 8px 0 2px");
    const glass = rule("playerGlassBar.css", ".lgp-range {");
    expect(glass).toContain("width: 84px");
    expect(glass).toContain("margin: 0 8px 0 2px");
    expect(glass).toContain("height: 24px");
    expect(glass).toContain("display: none");
  });

  it("les menus s'ouvrent là où s'ouvrent ceux d'avant : au-dessus de la capsule, à 80 px du bas de la fenêtre", () => {
    expect(rule("../chrome/playerPanels.css", ".pl-panel {")).toContain("bottom: calc(80px");
    expect(rule("playerGlassBar.css", ".lgp-popover {")).toContain("bottom: calc(var(--lg-player-caps-height) + var(--lg-player-row-gap))");
    // 20 (marge du dock) + 50 (capsule) + 10 (écart) = 80.
    expect(token("--lg-player-edge") + token("--lg-player-caps-height") + token("--lg-player-row-gap")).toBe(80);
    const menu = rule("playerGlassPanels.css", ".lgp-surface.lgp-menu {");
    expect(menu).toContain("min-width: 220px");
    expect(menu).toContain("max-height: calc(100vh - 170px)");
  });

  it("le coin bas-droit repose et monte comme les encarts sans verre", () => {
    // Pilule de saut : `bottom-10` (40 px), `-translate-y-16` (64 px).
    expect(token("--lg-player-corner-rest")).toBe(40);
    expect(token("--lg-player-corner-lift")).toBe(64);
    expect(rule("playerGlassOverlays.css", ".lgp-corner--card {")).toMatch(/--lg-player-corner-rest: 24px;[\s\S]*--lg-player-corner-lift: 80px/);
  });

  it("les encarts du coin et les panneaux gardent la même marge latérale", () => {
    expect(rule("playerGlassOverlays.css", ".lgp-corner {")).toContain("right: var(--lg-player-inline)");
    expect(rule("../chrome/playerPanels.css", ".pl-panel {")).toContain("right: 24px");
  });
});
