import { describe, expect, it } from "vitest";
import { calcColumns } from "./useItemsPerRow";

describe("calcColumns", () => {
  it("garde deux colonnes au minimum", () => {
    expect(calcColumns(0)).toBe(2);
    expect(calcColumns(200)).toBe(2);
  });

  it("resserre les cartes sur tablette", () => {
    // 820 px de fenêtre, 756 px de grille : quatre colonnes, plus trois.
    expect(calcColumns(756)).toBe(4);
  });

  it("ne change rien au bureau", () => {
    expect(calcColumns(1376)).toBe(7);
    expect(calcColumns(1856)).toBe(9);
  });
});
