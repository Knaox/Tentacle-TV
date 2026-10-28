import { describe, expect, it } from "vitest";
import { decideDismiss, decideOpen, decideSwipe, gestureAxis, rubberBand, sheetDragOffset, swipeExitOffset } from "./playerGestures";

describe("gestes du lecteur", () => {
  it("rien n'est pris sous le seuil, puis l'axe dominant", () => {
    expect(gestureAxis(4, 6)).toBeNull();
    expect(gestureAxis(30, 5)).toBe("horizontal");
    expect(gestureAxis(8, 30)).toBe("vertical");
  });

  it("la pochette balayée sort hors de la zone, du côté du geste", () => {
    expect(swipeExitOffset("next", 360)).toBeLessThan(-360);
    expect(swipeExitOffset("previous", 360)).toBeGreaterThan(360);
  });

  it("balayer : loin ou vif change de titre, gauche = suivant", () => {
    expect(decideSwipe(-120, 0, 360)).toBe("next");
    expect(decideSwipe(120, 0, 360)).toBe("previous");
    expect(decideSwipe(-40, -1.2, 360)).toBe("next");
    expect(decideSwipe(-40, -0.1, 360)).toBe("stay");
    expect(decideSwipe(-15, -2, 360)).toBe("stay");
  });

  it("refermer et ouvrir : distance ou vitesse", () => {
    expect(decideDismiss(200, 0)).toBe(true);
    expect(decideDismiss(60, 1.5)).toBe(true);
    expect(decideDismiss(60, 0.2)).toBe(false);
    expect(decideOpen(-60, 0)).toBe(true);
    expect(decideOpen(-20, -0.8)).toBe(true);
    expect(decideOpen(-20, 0)).toBe(false);
  });

  it("l'élastique ne dépasse jamais sa limite", () => {
    expect(rubberBand(50, true)).toBe(50);
    expect(Math.abs(rubberBand(10_000, false))).toBeLessThan(80);
    expect(rubberBand(-30, false)).toBeLessThan(0);
    expect(sheetDragOffset(120)).toBe(120);
    expect(sheetDragOffset(-500)).toBeGreaterThan(-40);
  });
});
