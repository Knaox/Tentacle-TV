import { describe, expect, it } from "vitest";
import postcss from "postcss";
import { evaluateLength, resolveLength } from "./evaluateLength";
import { fixedUnitsPass, resolveValue } from "./fixedUnitsPass";
import { createContext } from "./context";

/**
 * Le canvas vaut 1920×1080, donc 1 vw = 19,2 px et 1 vh = 10,8 px. Tous les
 * nombres attendus ci-dessous s'en déduisent à la main : c'est ce qui rend ce
 * banc lisible, et ce qui permet de vérifier l'évaluateur sans le rejouer.
 */

describe("evaluateLength", () => {
  it("convertit les unités du viewport", () => {
    expect(evaluateLength("100vw")).toBe(1920);
    expect(evaluateLength("100vh")).toBe(1080);
    expect(evaluateLength("50vmin")).toBe(540);
    expect(evaluateLength("50vmax")).toBe(960);
  });

  it("traite les trois variantes dynamiques comme le viewport", () => {
    // Une application n'a ni barre d'URL ni barre escamotable : `dvh`, `svh` et
    // `lvh` y désignent tous la même hauteur.
    for (const unit of ["dvh", "svh", "lvh"]) {
      expect(evaluateLength(`100${unit}`)).toBe(1080);
    }
  });

  it("convertit les rem à seize pixels", () => {
    expect(evaluateLength("2rem")).toBe(32);
  });

  it("résout les deux clamp() qui traînaient en style en ligne", () => {
    // Les titres de bannière. C'est le calcul exact que faisait Chromium 87 et
    // que Chrome 53 ignorait, d'où deux rendus selon la génération.
    expect(evaluateLength("clamp(1.75rem, 3.6vw, 3.25rem)")).toBe(52);
    expect(evaluateLength("clamp(2rem, 4.2vw, 3.5rem)")).toBe(56);
  });

  it("prend le plancher ou le plafond d'un clamp selon le cas", () => {
    expect(evaluateLength("clamp(100px, 1vw, 300px)")).toBe(100);
    expect(evaluateLength("clamp(10px, 90vw, 300px)")).toBe(300);
  });

  it("évalue min() et max() à n arguments", () => {
    expect(evaluateLength("min(100vw, 40rem, 500px)")).toBe(500);
    expect(evaluateLength("max(1rem, 2rem, 3rem)")).toBe(48);
  });

  it("évalue calc(), y compris imbriqué et avec priorités", () => {
    expect(evaluateLength("calc(100vh - 64px)")).toBe(1016);
    expect(evaluateLength("calc(100vw / 3)")).toBe(640);
    expect(evaluateLength("calc(2rem + 10px * 2)")).toBe(52);
    expect(evaluateLength("calc(calc(100vh - 80px) / 2)")).toBe(500);
    expect(evaluateLength("clamp(1rem, calc(2vw + 8px), 60px)")).toBe(46.4);
  });

  it("refuse ce qui dépend d'un context inconnu", () => {
    // Chacun pour une raison différente, et toutes irréductibles : le bloc
    // conteneur, la police de l'élément, la cascade, le matériel.
    for (const value of [
      "50%",
      "calc(100vw - 10%)",
      "2em",
      "min(100%, 40rem)",
      "max(1rem, env(safe-area-inset-top, 1rem))",
      "calc(100vh - var(--barre))",
      "clamp(1rem, 2ch, 3rem)",
    ]) {
      expect(evaluateLength(value)).toBeNull();
    }
  });

  it("refuse une expression bancale plutôt que d'en deviner une", () => {
    for (const value of ["clamp(1rem, 2vw)", "calc(100vw", "calc(1vw / 0)", "12quux"]) {
      expect(evaluateLength(value)).toBeNull();
    }
  });

  it("arrondit au centième, pas au bruit binaire", () => {
    expect(resolveLength("33.333vw")).toBe("639.99px");
  });
});

describe("resoudreValeur", () => {
  it("traite chaque composante d'une valeur à plusieurs longueurs", () => {
    expect(resolveValue("2vh 4vw")).toBe("21.6px 76.8px");
  });

  it("laisse passer ce qui n'est pas une longueur", () => {
    expect(resolveValue("calc(100vh - 20px) auto")).toBe("1060px auto");
  });

  it("ne découpe pas à l'intérieur d'une fonction", () => {
    expect(resolveValue("clamp(2rem, 4.2vw, 3.5rem)")).toBe("56px");
  });

  it("rend null quand rien n'est résoluble", () => {
    expect(resolveValue("min(100%, 40rem)")).toBeNull();
  });
});

describe("fixedUnitsPass", () => {
  const skip = (css: string) => {
    const context = createContext();
    const root = postcss.parse(css);
    fixedUnitsPass(root, context);
    return { css: root.toString(), report: context.report() };
  };

  it("réécrit la feuille en pixels", () => {
    const { css } = skip(".a{font-size:clamp(2rem,4.2vw,3.5rem);min-height:100dvh}");
    expect(css).toBe(".a{font-size:56px;min-height:1080px}");
  });

  it("ne touche pas à ce qu'elle ne sait pas résoudre", () => {
    const { css, report } = skip(".a{width:min(100%,40rem)}");
    expect(css).toBe(".a{width:min(100%,40rem)}");
    expect(report).toContain("unites-non-resolubles");
  });

  it("laisse tranquilles les déclarations sans unité de viewport", () => {
    expect(skip(".a{color:red;margin:8px}").css).toBe(".a{color:red;margin:8px}");
  });
});
