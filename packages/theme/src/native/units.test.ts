import { describe, expect, it } from "vitest";

import { parseMs, parsePx, parseScale, parseShadow } from "./units";

describe("conversion des grandeurs", () => {
  it("lit les pixels", () => {
    expect(parsePx("16px")).toBe(16);
    expect(parsePx("0px")).toBe(0);
    expect(parsePx("1.5px")).toBe(1.5);
  });

  it("lit les millisecondes", () => {
    expect(parseMs("240ms")).toBe(240);
  });

  it("lit les échelles", () => {
    expect(parseScale("1.08")).toBe(1.08);
  });

  it("se replie plutôt que de renvoyer NaN", () => {
    // Une valeur illisible qui passerait en NaN casserait la mise en page bien
    // plus loin, à un endroit qui n'aurait aucun rapport avec la cause.
    expect(parsePx("calc(100% - 2px)", 8)).toBe(8);
    expect(parseScale("hérité")).toBe(1);
  });
});

describe("conversion des ombres", () => {
  it("décompose une ombre du thème, dont le zéro est sans unité", () => {
    // La forme exacte de `--elev-1`. Un zéro s'écrit sans unité en CSS ; exiger
    // `px` partout faisait échouer la lecture des trois élévations, et donc
    // lever au chargement du module.
    expect(parseShadow("0 6px 18px rgba(0, 0, 0, 0.6)")).toEqual({
      shadowColor: "rgb(0, 0, 0)",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.6,
      shadowRadius: 18,
      elevation: 9,
    });
  });

  it("décompose une ombre dont toutes les longueurs portent leur unité", () => {
    expect(parseShadow("0px 6px 18px rgba(0, 0, 0, 0.6)")).toEqual({
      shadowColor: "rgb(0, 0, 0)",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.6,
      shadowRadius: 18,
      elevation: 9,
    });
  });

  it("sort l'alpha de la couleur", () => {
    // React Native lit l'opacité dans `shadowOpacity` ; la laisser aussi dans
    // la couleur la compterait deux fois et l'ombre sortirait bien trop claire.
    const shadow = parseShadow("0px 12px 36px rgba(0, 0, 0, 0.72)");
    expect(shadow?.shadowColor).not.toContain("0.72");
    expect(shadow?.shadowOpacity).toBe(0.72);
  });

  it("accepte une couleur hexadécimale, sans opacité", () => {
    const shadow = parseShadow("0px 2px 4px #000000");
    expect(shadow?.shadowColor).toBe("#000000");
    expect(shadow?.shadowOpacity).toBe(1);
  });

  it("renvoie null sur une ombre qu'il ne sait pas lire", () => {
    expect(parseShadow("inset 0px 1px 2px rgba(0,0,0,.5)")).toBeNull();
    expect(parseShadow("none")).toBeNull();
  });
});
