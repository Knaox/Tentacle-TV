import { describe, expect, it } from "vitest";
import { osdRevealTarget } from "./osdReveal";

describe("osdRevealTarget — le focus à la réapparition de l'habillage", () => {
  it("Lecture/Pause sur toute télécommande : le dernier bouton utilisé (Apple TV)", () => {
    expect(osdRevealTarget({ playPauseKey: "always" })).toBeNull();
  });

  it("Lecture/Pause sur certaines seulement : Lecture/Pause, pour que le second OK mette en pause", () => {
    expect(osdRevealTarget({ playPauseKey: "sometimes" })).toBe("playpause");
  });
});
