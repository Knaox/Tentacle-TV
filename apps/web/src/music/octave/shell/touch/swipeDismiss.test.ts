import { describe, expect, it } from "vitest";
import { swipeArms, swipeCloses, swipeOffset } from "./swipeDismiss";

describe("swipeDismiss", () => {
  it("ne s'arme qu'en haut de la feuille, sur une descente franche et verticale", () => {
    expect(swipeArms(0, 14, 0)).toBe(true);
    expect(swipeArms(0, 14, 30)).toBe(false); // la feuille défile d'abord
    expect(swipeArms(0, 6, 0)).toBe(false); // pas encore un geste
    expect(swipeArms(20, 14, 0)).toBe(false); // un geste de côté
    expect(swipeArms(0, -14, 0)).toBe(false); // une montée
  });

  it("suit le doigt vers le bas, freine au-dessus de sa place", () => {
    expect(swipeOffset(80)).toBe(80);
    expect(swipeOffset(-40)).toBe(-10);
  });

  it("ferme au-delà du seuil ou sur un lancer, revient sinon", () => {
    expect(swipeCloses(200, 0.1, 812)).toBe(true); // 200 ≥ 22 % de 812
    expect(swipeCloses(150, 0.1, 812)).toBe(false);
    expect(swipeCloses(130, 0.1, 400)).toBe(true); // plancher de 120 px
    expect(swipeCloses(40, 0.9, 812)).toBe(true); // lancé
    expect(swipeCloses(-30, 2, 812)).toBe(false);
  });
});
