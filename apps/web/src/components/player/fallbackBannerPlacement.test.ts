import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fallbackBannerTop, PLAYER_BACK_BUTTON, PLAYER_TOP_EDGE } from "./fallbackBannerPlacement";

const css = readFileSync(join(__dirname, "chrome/playerChrome.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** Le bloc de déclarations d'une classe de l'habillage du lecteur. */
function rule(selector: string): string {
  const at = css.indexOf(selector);
  if (at < 0) throw new Error(`${selector} introuvable`);
  return css.slice(css.indexOf("{", at) + 1, css.indexOf("}", at));
}

describe("le bandeau « Lecteur de secours » se pose sous la rangée du haut du lecteur", () => {
  it("ses mesures sont celles de l'habillage : changer l'un sans l'autre casse ici", () => {
    expect(rule(".pl-bar--top {")).toContain(`padding: max(${PLAYER_TOP_EDGE}px,`);
    // La règle qui COMMENCE par la classe : la première occurrence est une variante sans ombre.
    expect(rule("\n.pl-btn--solo {")).toContain(`height: ${PLAYER_BACK_BUTTON}px`);
  });

  it("dans un navigateur : sous la sortie et le titre, jamais à leur hauteur", () => {
    expect(fallbackBannerTop(0)).toBe(64);
  });

  it("sur le bureau : sous le bandeau de fenêtre, puis sous la rangée du lecteur", () => {
    expect(fallbackBannerTop(38)).toBe(102);
  });
});
