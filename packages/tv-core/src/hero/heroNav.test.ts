import { describe, expect, it } from "vitest";
import { heroChevrons, heroMove } from "./heroNav";
import { heroRotationActive } from "./rotation";

describe("la bannière à UNE cible", () => {
  it("DROITE : le titre suivant, en boucle ; seul, elle ne bouge pas", () => {
    expect(heroMove("droite", 0, 5)).toEqual({ kind: "slide", index: 1, direction: 1 });
    expect(heroMove("droite", 4, 5)).toEqual({ kind: "slide", index: 0, direction: 1 });
    expect(heroMove("droite", 0, 1)).toEqual({ kind: "stay" });
  });

  it("GAUCHE : le titre précédent ; sur le premier, le rail", () => {
    expect(heroMove("gauche", 3, 5)).toEqual({ kind: "slide", index: 2, direction: -1 });
    expect(heroMove("gauche", 0, 5)).toEqual({ kind: "rail" });
    expect(heroMove("gauche", 0, 1)).toEqual({ kind: "rail" });
  });

  it("BAS mène aux rangées, HAUT ne fait rien", () => {
    expect(heroMove("bas", 2, 5)).toEqual({ kind: "rows" });
    expect(heroMove("haut", 2, 5)).toEqual({ kind: "stay" });
  });

  it("les chevrons disent où l'on peut tourner", () => {
    expect(heroChevrons(0, 5)).toEqual({ back: false, forward: true });
    expect(heroChevrons(2, 5)).toEqual({ back: true, forward: true });
    expect(heroChevrons(0, 1)).toEqual({ back: false, forward: false });
  });

  it("elle ne tourne jamais sous le focus", () => {
    expect(heroRotationActive({ shown: true, appActive: true, count: 5, focused: true })).toBe(false);
    expect(heroRotationActive({ shown: true, appActive: true, count: 5, focused: false })).toBe(true);
  });
});
