import { describe, expect, it } from "vitest";
import {
  REVEAL_ANCHOR_TOP,
  REVEAL_NEAREST_MARGIN,
  benchRevealOffset,
  clampRevealOffset,
  layoutShift,
  revealOffset,
  type RevealPage,
} from "./reveal";

/** Une page de 1 080 points de haut, 4 000 de contenu, sans retrait. */
const PAGE: RevealPage = { viewport: 1080, content: 4000, insetTop: 0, insetBottom: 0 };

describe("clampRevealOffset — ce que la page peut montrer", () => {
  it("entre le haut (moins le retrait) et le bas du contenu", () => {
    expect(clampRevealOffset(-40, PAGE)).toBe(0);
    expect(clampRevealOffset(5000, PAGE)).toBe(2920);
    expect(clampRevealOffset(-40, { ...PAGE, insetTop: 30 })).toBe(-30);
    expect(clampRevealOffset(5000, { ...PAGE, insetBottom: 160 })).toBe(3080);
  });

  it("un contenu plus court que l'écran ne défile pas", () => {
    expect(clampRevealOffset(300, { ...PAGE, content: 900 })).toBe(0);
  });
});

describe("revealOffset — la cible de la section focalisée", () => {
  it("les défauts : marge 56, ancre à 72", () => {
    expect(REVEAL_NEAREST_MARGIN).toBe(56);
    expect(REVEAL_ANCHOR_TOP).toBe(72);
  });

  it("start : la page tout en haut (le héros, la 1re ligne d'une grille)", () => {
    expect(revealOffset({ mode: "start" }, { top: 760, height: 400 }, PAGE, 900)).toBe(0);
  });

  it("anchor : le haut de la section à `top` du haut de l'écran (la fiche)", () => {
    expect(revealOffset({ mode: "anchor", top: 72 }, { top: 1500, height: 600 }, PAGE, 0)).toBe(1428);
    expect(revealOffset({ mode: "anchor" }, { top: 1500, height: 600 }, PAGE, 0)).toBe(1428);
  });

  it("nearest, en descendant : juste assez pour montrer son bas, à 56 du bord", () => {
    // Section de 760 à 1160 : son bas + 56 dépasse l'écran de 136.
    expect(revealOffset({ mode: "nearest" }, { top: 760, height: 400 }, PAGE, 0)).toBe(136);
  });

  it("nearest, en remontant : son haut à 56 du bord", () => {
    expect(revealOffset({ mode: "nearest" }, { top: 760, height: 400 }, PAGE, 900)).toBe(704);
  });

  it("nearest : déjà entière dans la marge, la page ne bouge pas", () => {
    expect(revealOffset({ mode: "nearest" }, { top: 760, height: 400 }, PAGE, 300)).toBe(300);
  });

  it("nearest : plus haute que l'écran, jamais au-delà de son haut", () => {
    expect(revealOffset({ mode: "nearest" }, { top: 760, height: 1400 }, PAGE, 0)).toBe(704);
  });

  it("nearest : la marge de la section", () => {
    expect(revealOffset({ mode: "nearest", margin: 80 }, { top: 760, height: 400 }, PAGE, 0)).toBe(160);
  });

  it("la cible reste bornée à la page", () => {
    expect(revealOffset({ mode: "nearest" }, { top: 3700, height: 300 }, PAGE, 0)).toBe(2920);
    expect(revealOffset({ mode: "anchor", top: 72 }, { top: 40, height: 300 }, PAGE, 500)).toBe(0);
  });
});

describe("layoutShift — la section montrée a bougé pendant un montage", () => {
  it("la même section : la page la suit de l'écart", () => {
    expect(layoutShift(true, 1200, 1460)).toBe(260);
    expect(layoutShift(true, 1200, 1100)).toBe(-100);
  });

  it("moins d'un demi-point : rien ne bouge, mais la section se montre de nouveau", () => {
    expect(layoutShift(true, 1200, 1200.4)).toBe(0);
  });

  it("une AUTRE section, ou une position inconnue : rien du tout", () => {
    expect(layoutShift(false, 1200, 1460)).toBeNull();
    expect(layoutShift(true, null, 1460)).toBeNull();
    expect(layoutShift(true, 1200, null)).toBeNull();
  });
});

describe("benchRevealOffset — le banc, focus figé", () => {
  it("la section entière à 56 du bas, au plus près du haut", () => {
    expect(benchRevealOffset({ top: 760, height: 400 }, 1080)).toBe(136);
  });

  it("une section déjà visible : la page en haut", () => {
    expect(benchRevealOffset({ top: 200, height: 400 }, 1080)).toBe(0);
  });

  it("jamais au-delà de son haut moins la marge, jamais sous zéro", () => {
    expect(benchRevealOffset({ top: 760, height: 1400 }, 1080)).toBe(704);
    expect(benchRevealOffset({ top: 20, height: 1400 }, 1080)).toBe(0);
  });
});
