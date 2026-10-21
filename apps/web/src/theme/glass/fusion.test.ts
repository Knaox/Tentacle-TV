import { describe, expect, it } from "vitest";

import { correctedRadius, flipTransform, fusionGroups, fusionLayout, rectGap, unionRect } from "./fusion";

const r = (x: number, width = 40) => ({ x, y: 0, width, height: 40 });

describe("fusion de verres voisins", () => {
  it("mesure l'écart entre deux formes", () => {
    expect(rectGap(r(0), r(50))).toBe(10);
    expect(rectGap(r(0), r(20))).toBe(0);
    expect(rectGap({ x: 0, y: 0, width: 10, height: 10 }, { x: 13, y: 14, width: 5, height: 5 })).toBe(5);
  });

  it("groupe transitivement, dans l'ordre des membres", () => {
    const groups = fusionGroups(
      [
        { id: "a", rect: r(0) },
        { id: "b", rect: r(48) },
        { id: "c", rect: r(96) },
        { id: "d", rect: r(300) },
      ],
      12,
    );
    expect(groups.map((g) => g.map((m) => m.id))).toEqual([["a", "b", "c"], ["d"]]);
  });

  it("un seul membre dessine l'enveloppe d'un groupe", () => {
    const shapes = fusionLayout(
      [
        { id: "play", rect: r(0) },
        { id: "next", rect: r(44) },
        { id: "menu", rect: r(200) },
      ],
      8,
    );
    expect(shapes).toEqual([
      { id: "play", rect: unionRect([r(0), r(44)]), visible: true, group: "play" },
      { id: "next", rect: unionRect([r(0), r(44)]), visible: false, group: "play" },
      { id: "menu", rect: r(200), visible: true, group: "menu" },
    ]);
  });

  it("spacing nul : chaque forme reste seule, même collée", () => {
    expect(fusionLayout([{ id: "a", rect: r(0) }, { id: "b", rect: r(40) }], 0).every((s) => s.visible)).toBe(true);
  });

  it("FLIP : la barre paraît à la place du bouton qui l'a fait naître", () => {
    const button = { x: 10, y: 10, width: 40, height: 40 };
    const bar = { x: 0, y: 0, width: 400, height: 56 };
    expect(flipTransform(button, bar)).toEqual({ x: 10, y: 10, scaleX: 0.1, scaleY: 40 / 56 });
    expect(correctedRadius(20, 0.1, 0.5)).toBe("200px / 40px");
  });
});
