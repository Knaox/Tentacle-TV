import { describe, expect, it } from "vitest";
import { glidingIndexes, gridSides, roomIsEmpty, roomShifts, sameLine, translateX } from "./roomGeometry";

/**
 * La place que les voisines font à la mini-carte. Une rangée d'affiches de
 * 200 px au pas de 212 (écart de 12 px), mini-carte de 331 px centrée sur la
 * carte de 600 → 800 : elle en dépasse de 65,5 px de chaque côté.
 */
describe("roomShifts — ce que glissent les voisines", () => {
  it("rend l'écart d'origine des deux côtés quand la mini-carte est centrée", () => {
    const shifts = roomShifts({ left: 600, right: 800 }, { left: 534.5, right: 865.5 });
    expect(shifts).toEqual({ left: 66, right: 66 });
    // La voisine de gauche finissait à 588 : décalée de 66, elle finit à 522,
    // soit 12,5 px avant la mini-carte — l'écart de la rangée, au demi-pixel.
    expect(534.5 - (588 - shifts.left)).toBeCloseTo(12.5, 1);
  });

  it("pousse tout d'un seul côté quand la mini-carte est rentrée dans la fenêtre", () => {
    expect(roomShifts({ left: 20, right: 220 }, { left: 16, right: 347 })).toEqual({ left: 4, right: 127 });
    expect(roomShifts({ left: 1220, right: 1420 }, { left: 1093, right: 1424 })).toEqual({ left: 127, right: 4 });
    expect(roomShifts({ left: 10, right: 210 }, { left: 16, right: 347 })).toEqual({ left: 0, right: 137 });
  });

  it("ne fait rien glisser quand la mini-carte ne dépasse pas de sa carte", () => {
    expect(roomIsEmpty(roomShifts({ left: 0, right: 600 }, { left: 16, right: 584 }))).toBe(true);
    expect(roomIsEmpty(roomShifts({ left: 600, right: 800 }, { left: 534, right: 866 }))).toBe(false);
  });
});

describe("sameLine / gridSides — une grille ne bouge que la ligne de la carte", () => {
  const cell = (col: number, row: number) => ({
    left: col * 156,
    right: col * 156 + 140,
    top: row * 300,
    bottom: row * 300 + 276,
  });

  it("reconnaît la ligne même quand une carte est un peu plus haute (titre sur deux lignes)", () => {
    expect(sameLine({ top: 0, bottom: 276 }, { top: 0, bottom: 296 })).toBe(true);
    expect(sameLine({ top: 0, bottom: 276 }, { top: 300, bottom: 576 })).toBe(false);
    expect(sameLine({ top: 0, bottom: 0 }, { top: 0, bottom: 10 })).toBe(false);
  });

  it("pose « avant » et « après » sur la ligne de la carte, rien ailleurs", () => {
    // Deux lignes de quatre ; la carte est la 3e de la 1re ligne.
    const items = [0, 1, 2, 3].flatMap((col) => [cell(col, 0)]).concat([0, 1, 2, 3].map((col) => cell(col, 1)));
    expect(gridSides(items, 2)).toEqual(["before", "before", null, "after", null, null, null, null]);
  });
});

describe("glidingIndexes — seuls glissent ceux qu'on voit, plus un de chaque côté", () => {
  const row = Array.from({ length: 12 }, (_, i) => ({ left: i * 212 - 300, right: i * 212 - 100 }));

  it("prend la zone visible et un élément de part et d'autre", () => {
    // Visibles dans [0, 1440] : de l'index 1 (−88 → 112) à l'index 8 (1396 → 1596).
    expect(glidingIndexes(row, { left: 0, right: 1440 })).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("borne aux extrémités de la rangée, et rend rien quand rien n'est visible", () => {
    expect(glidingIndexes(row.slice(0, 3), { left: 0, right: 1440 })).toEqual([0, 1, 2]);
    expect(glidingIndexes(row, { left: 5000, right: 6000 })).toEqual([]);
  });
});

describe("translateX — le glissement en cours, lu sur le style calculé", () => {
  it("lit l'axe horizontal, quelle que soit la forme de la valeur", () => {
    expect(translateX("none")).toBe(0);
    expect(translateX("")).toBe(0);
    expect(translateX(null)).toBe(0);
    expect(translateX("-66px")).toBe(-66);
    expect(translateX("12.5px 0px")).toBe(12.5);
  });
});
