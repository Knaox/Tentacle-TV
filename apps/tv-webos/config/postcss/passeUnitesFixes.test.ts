import { describe, expect, it } from "vitest";
import postcss from "postcss";
import { evaluerLongueur, resoudreLongueur } from "./evaluerLongueur";
import { passeUnitesFixes, resoudreValeur } from "./passeUnitesFixes";
import { creerContexte } from "./contexte";

/**
 * Le canevas vaut 1920×1080, donc 1 vw = 19,2 px et 1 vh = 10,8 px. Tous les
 * nombres attendus ci-dessous s'en déduisent à la main : c'est ce qui rend ce
 * banc lisible, et ce qui permet de vérifier l'évaluateur sans le rejouer.
 */

describe("evaluerLongueur", () => {
  it("convertit les unités du viewport", () => {
    expect(evaluerLongueur("100vw")).toBe(1920);
    expect(evaluerLongueur("100vh")).toBe(1080);
    expect(evaluerLongueur("50vmin")).toBe(540);
    expect(evaluerLongueur("50vmax")).toBe(960);
  });

  it("traite les trois variantes dynamiques comme le viewport", () => {
    // Une application n'a ni barre d'URL ni barre escamotable : `dvh`, `svh` et
    // `lvh` y désignent tous la même hauteur.
    for (const unite of ["dvh", "svh", "lvh"]) {
      expect(evaluerLongueur(`100${unite}`)).toBe(1080);
    }
  });

  it("convertit les rem à seize pixels", () => {
    expect(evaluerLongueur("2rem")).toBe(32);
  });

  it("résout les deux clamp() qui traînaient en style en ligne", () => {
    // Les titres de bannière. C'est le calcul exact que faisait Chromium 87 et
    // que Chrome 53 ignorait, d'où deux rendus selon la génération.
    expect(evaluerLongueur("clamp(1.75rem, 3.6vw, 3.25rem)")).toBe(52);
    expect(evaluerLongueur("clamp(2rem, 4.2vw, 3.5rem)")).toBe(56);
  });

  it("prend le plancher ou le plafond d'un clamp selon le cas", () => {
    expect(evaluerLongueur("clamp(100px, 1vw, 300px)")).toBe(100);
    expect(evaluerLongueur("clamp(10px, 90vw, 300px)")).toBe(300);
  });

  it("évalue min() et max() à n arguments", () => {
    expect(evaluerLongueur("min(100vw, 40rem, 500px)")).toBe(500);
    expect(evaluerLongueur("max(1rem, 2rem, 3rem)")).toBe(48);
  });

  it("évalue calc(), y compris imbriqué et avec priorités", () => {
    expect(evaluerLongueur("calc(100vh - 64px)")).toBe(1016);
    expect(evaluerLongueur("calc(100vw / 3)")).toBe(640);
    expect(evaluerLongueur("calc(2rem + 10px * 2)")).toBe(52);
    expect(evaluerLongueur("calc(calc(100vh - 80px) / 2)")).toBe(500);
    expect(evaluerLongueur("clamp(1rem, calc(2vw + 8px), 60px)")).toBe(46.4);
  });

  it("refuse ce qui dépend d'un contexte inconnu", () => {
    // Chacun pour une raison différente, et toutes irréductibles : le bloc
    // conteneur, la police de l'élément, la cascade, le matériel.
    for (const valeur of [
      "50%",
      "calc(100vw - 10%)",
      "2em",
      "min(100%, 40rem)",
      "max(1rem, env(safe-area-inset-top, 1rem))",
      "calc(100vh - var(--barre))",
      "clamp(1rem, 2ch, 3rem)",
    ]) {
      expect(evaluerLongueur(valeur)).toBeNull();
    }
  });

  it("refuse une expression bancale plutôt que d'en deviner une", () => {
    for (const valeur of ["clamp(1rem, 2vw)", "calc(100vw", "calc(1vw / 0)", "12quux"]) {
      expect(evaluerLongueur(valeur)).toBeNull();
    }
  });

  it("arrondit au centième, pas au bruit binaire", () => {
    expect(resoudreLongueur("33.333vw")).toBe("639.99px");
  });
});

describe("resoudreValeur", () => {
  it("traite chaque composante d'une valeur à plusieurs longueurs", () => {
    expect(resoudreValeur("2vh 4vw")).toBe("21.6px 76.8px");
  });

  it("laisse passer ce qui n'est pas une longueur", () => {
    expect(resoudreValeur("calc(100vh - 20px) auto")).toBe("1060px auto");
  });

  it("ne découpe pas à l'intérieur d'une fonction", () => {
    expect(resoudreValeur("clamp(2rem, 4.2vw, 3.5rem)")).toBe("56px");
  });

  it("rend null quand rien n'est résoluble", () => {
    expect(resoudreValeur("min(100%, 40rem)")).toBeNull();
  });
});

describe("passeUnitesFixes", () => {
  const passer = (css: string) => {
    const contexte = creerContexte();
    const racine = postcss.parse(css);
    passeUnitesFixes(racine, contexte);
    return { css: racine.toString(), rapport: contexte.rapport() };
  };

  it("réécrit la feuille en pixels", () => {
    const { css } = passer(".a{font-size:clamp(2rem,4.2vw,3.5rem);min-height:100dvh}");
    expect(css).toBe(".a{font-size:56px;min-height:1080px}");
  });

  it("ne touche pas à ce qu'elle ne sait pas résoudre", () => {
    const { css, rapport } = passer(".a{width:min(100%,40rem)}");
    expect(css).toBe(".a{width:min(100%,40rem)}");
    expect(rapport).toContain("unites-non-resolubles");
  });

  it("laisse tranquilles les déclarations sans unité de viewport", () => {
    expect(passer(".a{color:red;margin:8px}").css).toBe(".a{color:red;margin:8px}");
  });
});
