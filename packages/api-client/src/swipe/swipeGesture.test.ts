import { describe, expect, it } from "vitest";
import { exitTarget, verdictFromDrag } from "./swipeGesture";

describe("lecture du glisser", () => {
  it("à droite : j'aime ; à gauche : pas pour moi ; vers le haut : coup de cœur", () => {
    expect(verdictFromDrag(140, 10, 0, 0)).toBe("like");
    expect(verdictFromDrag(-140, -10, 0, 0)).toBe("dislike");
    expect(verdictFromDrag(20, -150, 0, 0)).toBe("superlike");
  });

  it("un lancer rapide suffit, un frôlement non", () => {
    expect(verdictFromDrag(40, 0, 900, 0)).toBe("like");
    expect(verdictFromDrag(10, 0, 900, 0)).toBeNull();
    expect(verdictFromDrag(60, 5, 100, 0)).toBeNull();
  });

  it("un like qui remonte un peu reste un like ; le bas ne juge jamais", () => {
    expect(verdictFromDrag(150, -90, 0, 0)).toBe("like");
    expect(verdictFromDrag(0, 300, 0, 2000)).toBeNull();
  });

  it("la carte sort dans la direction du verdict", () => {
    expect(exitTarget("like", 1000).x).toBeGreaterThan(1000);
    expect(exitTarget("dislike", 1000).x).toBeLessThan(-1000);
    expect(exitTarget("superlike", 1000).y).toBeLessThan(0);
    expect(exitTarget("skip", 1000).y).toBeGreaterThan(0);
  });
});
