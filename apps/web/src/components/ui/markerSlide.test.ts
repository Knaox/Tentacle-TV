import { beforeEach, describe, expect, it } from "vitest";
import { MARKER_HANDOFF_MS, markerOrigin, rememberMarker, resetSlidingMarkersForTests, sameBox, slideFromTransform } from "./markerSlide";

const home = { top: 15, left: 180, width: 88, height: 38 };
const films = { top: 15, left: 372, width: 62, height: 38 };

describe("le repère qui glisse d'une option à l'autre", () => {
  beforeEach(resetSlidingMarkersForTests);

  it("part de l'option quittée : translation vers son coin, échelle de sa taille", () => {
    expect(slideFromTransform(home, films)).toBe(`translate3d(-192px, 0px, 0) scale(${88 / 62}, 1)`);
  });

  it("le repère qui se monte reprend la place de celui qui vient de partir", () => {
    rememberMarker("nav", home, 1000);
    expect(markerOrigin("nav", films, 1004)).toEqual(home);
  });

  it("un autre groupe ne lui prête pas son repère", () => {
    rememberMarker("nav", home, 1000);
    expect(markerOrigin("filtres", films, 1004)).toBeNull();
  });

  it("un repère parti depuis longtemps n'est pas celui d'où l'on vient : le nouveau se pose", () => {
    rememberMarker("nav", home, 1000);
    expect(markerOrigin("nav", films, 1000 + MARKER_HANDOFF_MS + 1)).toBeNull();
  });

  it("au même endroit (la page s'est re-rendue), rien ne glisse", () => {
    rememberMarker("nav", home, 1000);
    expect(markerOrigin("nav", { ...home, left: home.left + 0.4 }, 1002)).toBeNull();
    expect(sameBox(home, films)).toBe(false);
  });

  it("un repère sans taille (option cachée) ne glisse pas", () => {
    rememberMarker("nav", home, 1000);
    expect(markerOrigin("nav", { top: 0, left: 0, width: 0, height: 0 }, 1002)).toBeNull();
  });
});
