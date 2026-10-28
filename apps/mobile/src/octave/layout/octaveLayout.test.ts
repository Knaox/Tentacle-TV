import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ useWindowDimensions: () => ({ width: 390, height: 844 }) }));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const { octaveLayoutOf } = await import("./useOctaveLayout");

describe("la mise en page d'Octave", () => {
  it("téléphone : marges de 16, ~2,3 pochettes par étagère, deux colonnes au moins", () => {
    const layout = octaveLayoutOf(390, 0, false, 47, 140);
    expect(layout.gutter).toBe(16);
    expect(layout.columns(160)).toBe(2);
    expect(layout.shelfItemWidth).toBeGreaterThan(130);
    expect(layout.shelfItemWidth * 2.3).toBeLessThanOrEqual(390 - 32);
  });

  it("tablette : la barre latérale déduite, plus de colonnes, une mesure de lecture bornée", () => {
    const layout = octaveLayoutOf(1194, 248, true, 24, 24);
    expect(layout.contentWidth).toBe(946);
    expect(layout.gutter).toBe(24);
    expect(layout.columns(160)).toBeGreaterThanOrEqual(5);
    expect(layout.readableWidth).toBe(640);
  });

  it("les cartes d'une grille tiennent exactement dans la largeur", () => {
    const layout = octaveLayoutOf(820, 248, true, 0, 0);
    const n = layout.columns(150);
    expect(n * layout.itemWidth(n) + (n - 1) * layout.gap).toBeLessThanOrEqual(layout.contentWidth - 2 * layout.gutter);
  });
});
