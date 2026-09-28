import { describe, expect, it } from "vitest";
import { DISTANCE_THRESHOLD, STAMP_START, exitTarget, stampStrength, verdictFromDrag } from "./swipeGesture";
import type { SwipeVerdict } from "./swipeTypes";

describe("lecture du glisser", () => {
  it("à droite : j'aime ; à gauche : pas pour moi ; vers le haut : coup de cœur ; vers le bas : passer", () => {
    expect(verdictFromDrag(140, 10, 0, 0)).toBe("like");
    expect(verdictFromDrag(-140, -10, 0, 0)).toBe("dislike");
    expect(verdictFromDrag(20, -150, 0, 0)).toBe("superlike");
    expect(verdictFromDrag(-20, 150, 0, 0)).toBe("skip");
  });

  it("un lancer rapide suffit, un frôlement non — dans les quatre directions", () => {
    expect(verdictFromDrag(40, 0, 900, 0)).toBe("like");
    expect(verdictFromDrag(-40, 0, -900, 0)).toBe("dislike");
    expect(verdictFromDrag(0, -40, 0, -900)).toBe("superlike");
    expect(verdictFromDrag(0, 40, 0, 900)).toBe("skip");
    expect(verdictFromDrag(10, 0, 900, 0)).toBeNull();
    expect(verdictFromDrag(0, -10, 0, -900)).toBeNull();
    expect(verdictFromDrag(0, 10, 0, 900)).toBeNull();
    expect(verdictFromDrag(60, 5, 100, 0)).toBeNull();
  });

  it("un lancer à contresens de la course ne juge pas", () => {
    // Tiré vers le bas puis relâché en remontant d'un coup sec.
    expect(verdictFromDrag(0, 60, 0, -900)).toBeNull();
  });

  it("l'axe qui domine décide : un like qui remonte ou descend un peu reste un like", () => {
    expect(verdictFromDrag(150, -90, 0, 0)).toBe("like");
    expect(verdictFromDrag(150, 90, 0, 0)).toBe("like");
    expect(verdictFromDrag(115, 130, 0, 0)).toBe("skip");
    expect(verdictFromDrag(115, -130, 0, 0)).toBe("superlike");
    expect(verdictFromDrag(-130, 115, 0, 0)).toBe("dislike");
  });

  it("en deçà du seuil, la carte revient", () => {
    expect(verdictFromDrag(0, DISTANCE_THRESHOLD, 0, 0)).toBeNull();
    expect(verdictFromDrag(0, DISTANCE_THRESHOLD + 1, 0, 0)).toBe("skip");
    expect(verdictFromDrag(0, 0, 0, 0)).toBeNull();
  });
});

describe("tampons du glisser", () => {
  const all: SwipeVerdict[] = ["like", "dislike", "superlike", "skip"];
  const lit = (dx: number, dy: number) => all.filter((v) => stampStrength(v, dx, dy) > 0);

  it("un seul tampon à la fois, celui de l'axe qui domine", () => {
    expect(lit(80, 10)).toEqual(["like"]);
    expect(lit(-80, 10)).toEqual(["dislike"]);
    expect(lit(10, -80)).toEqual(["superlike"]);
    expect(lit(10, 80)).toEqual(["skip"]);
    expect(lit(100, 120)).toEqual(["skip"]);
    expect(lit(0, 0)).toEqual([]);
  });

  it("plein au seuil : ce qu'il annonce est ce que le lâcher décide", () => {
    expect(stampStrength("skip", 0, STAMP_START)).toBe(0);
    expect(stampStrength("skip", 0, DISTANCE_THRESHOLD)).toBe(1);
    expect(stampStrength("skip", 0, 400)).toBe(1);
    for (const [dx, dy] of [[140, 10], [-140, -10], [20, -150], [-20, 150], [115, 130]] as const) {
      const verdict = verdictFromDrag(dx, dy, 0, 0);
      expect(verdict).not.toBeNull();
      expect(stampStrength(verdict as SwipeVerdict, dx, dy)).toBe(1);
    }
  });
});

describe("sortie de la carte", () => {
  it("la carte sort dans la direction du verdict", () => {
    expect(exitTarget("like", 1000).x).toBeGreaterThan(1000);
    expect(exitTarget("dislike", 1000).x).toBeLessThan(-1000);
    expect(exitTarget("superlike", 1000).y).toBeLessThan(0);
    expect(exitTarget("skip", 1000).y).toBeGreaterThan(0);
  });

  it("elle garde le décalage de l'autre axe au lâcher", () => {
    expect(exitTarget("skip", 1000, { x: 30, y: 140 }).x).toBe(30);
    expect(exitTarget("superlike", 1000, { x: -25, y: -130 }).x).toBe(-25);
    expect(exitTarget("like", 1000, { x: 150, y: -60 }).y).toBe(-20);
    expect(exitTarget(null, 1000, { x: 150, y: -60 })).toEqual({ x: 0, y: 0 });
  });
});
