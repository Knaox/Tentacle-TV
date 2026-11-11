/**
 * Le vol de l'affiche en `transform` seul : la boîte posée sur la carte doit arriver
 * EXACTEMENT sur l'affiche de la fiche, sinon elle saute en se posant. Les proportions
 * différentes gardent le vol en mise en page.
 */

import { describe, expect, it } from "vitest";
import { flightToTransform, sameAspect } from "./DetailFlight";

const card = { top: 300, left: 100, width: 160, height: 240 };
const poster = { top: 500, left: 64, width: 240, height: 360 };

describe("fiche › le vol de l'affiche", () => {
  it("arrive sur l'affiche : translation vers son coin, échelle de sa largeur", () => {
    expect(flightToTransform(card, poster)).toBe("translate3d(-36px, 200px, 0) scale(1.5)");
  });

  it("affiche vers affiche : échelle uniforme ; vignette 16:9 vers affiche 2:3 : repli en mise en page", () => {
    expect(sameAspect(card, poster)).toBe(true);
    expect(sameAspect({ top: 0, left: 0, width: 320, height: 180 }, poster)).toBe(false);
  });
});
