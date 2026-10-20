import { describe, expect, it } from "vitest";
import { decideRowSwipe } from "./rowSwipe";

const W = 390; // seuil : 96 pt

describe("decideRowSwipe", () => {
  it("vers la droite, marque lue une notification non lue", () => {
    expect(decideRowSwipe({ dx: 110, vx: 0.1, width: W, read: false })).toBe("markRead");
    expect(decideRowSwipe({ dx: 60, vx: 1, width: W, read: false })).toBe("markRead");
  });

  it("vers la droite, ne fait rien sur une notification déjà lue", () => {
    expect(decideRowSwipe({ dx: 200, vx: 2, width: W, read: true })).toBe("none");
  });

  it("vers la gauche, supprime — un peu plus loin, contre les faux départs", () => {
    expect(decideRowSwipe({ dx: -140, vx: -0.1, width: W, read: true })).toBe("delete");
    expect(decideRowSwipe({ dx: -100, vx: -0.1, width: W, read: true })).toBe("none");
    expect(decideRowSwipe({ dx: -60, vx: -1, width: W, read: false })).toBe("delete");
  });

  it("un geste trop court ne fait rien", () => {
    expect(decideRowSwipe({ dx: 30, vx: 0.2, width: W, read: false })).toBe("none");
    expect(decideRowSwipe({ dx: -30, vx: -2, width: W, read: false })).toBe("none");
  });

  it("le seuil suit une ligne étroite (panneau, iPhone SE)", () => {
    expect(decideRowSwipe({ dx: 85, vx: 0, width: 320, read: false })).toBe("markRead");
  });
});
