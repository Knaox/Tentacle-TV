/**
 * Le vol de l'affiche en `transform` seul : la boîte posée sur sa place finale
 * doit retomber EXACTEMENT sur la carte au départ, sinon le premier pas du vol
 * saute. Les proportions différentes gardent le vol en mise en page.
 */

import { describe, expect, it } from "vitest";
import { flightFromTransform, sameAspect } from "./DetailFlight";

const card = { top: 300, left: 100, width: 160, height: 240 };
const poster = { top: 500, left: 64, width: 240, height: 360 };

describe("fiche › le vol de l'affiche", () => {
  it("part de la carte : translation vers son coin, échelle de sa largeur", () => {
    expect(flightFromTransform(card, poster)).toBe("translate3d(36px, -200px, 0) scale(0.6666666666666666)");
  });

  it("affiche vers affiche : échelle uniforme ; vignette 16:9 vers affiche 2:3 : repli en mise en page", () => {
    expect(sameAspect(card, poster)).toBe(true);
    expect(sameAspect({ top: 0, left: 0, width: 320, height: 180 }, poster)).toBe(false);
  });
});
