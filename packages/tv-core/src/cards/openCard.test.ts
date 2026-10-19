import { describe, expect, it } from "vitest";
import { OPEN_CARD_HEIGHT, OPEN_ROW, openCardIsPast, openCardLeft, openCardMetricsOf, openRowShift } from "./openCard";
import { CARD_SIZES, DEFAULT_CARD_SIZE } from "./cardSize";

describe("la carte qui s'ouvre", () => {
  it("une seule hauteur par préréglage ; Grande (le défaut) est celle du banc validé", () => {
    expect(DEFAULT_CARD_SIZE).toBe("large");
    expect(openCardMetricsOf("large")).toMatchObject({ height: 500, posterWidth: 333, openWidth: 889 });
    expect(openCardMetricsOf("small")).toMatchObject({ height: 360, posterWidth: 240, openWidth: 640 });
    // Les trois préréglages vont du plus petit au plus grand.
    const heights = CARD_SIZES.map((s) => OPEN_CARD_HEIGHT[s]);
    expect([...heights].sort((a, b) => a - b)).toEqual(heights);
  });

  it("la carte ouverte garde la hauteur de l'affiche, en 16:9", () => {
    for (const size of CARD_SIZES) {
      const m = openCardMetricsOf(size);
      expect(Math.abs(m.openWidth / m.height - 16 / 9)).toBeLessThan(0.01);
      expect(Math.abs(m.posterWidth / m.height - 2 / 3)).toBeLessThan(0.01);
    }
  });

  it("la rangée a une hauteur FIXE : les détails ont leur place, rien ne se remet en page", () => {
    const m = openCardMetricsOf("large");
    expect(m.rowHeight).toBe(OPEN_ROW.titleHeight + 500 + OPEN_ROW.belowGap + OPEN_ROW.detailsHeight + OPEN_ROW.rowGap);
    // La rangée focalisée tient sous son ancrage (56), et la suivante pointe son titre.
    expect(56 + m.rowHeight).toBeLessThan(1080 - 44);
  });

  it("la carte focalisée se pose au bord gauche ; celles d'avant sont passées", () => {
    const m = openCardMetricsOf("large");
    expect(openRowShift(0, m)).toBe(0);
    expect(openRowShift(3, m)).toBe(3 * (333 + 36));
    expect(openCardLeft(3, m) - openRowShift(3, m)).toBe(0);
    expect(openCardIsPast(1, 3)).toBe(true);
    expect(openCardIsPast(3, 3)).toBe(false);
    expect(openCardIsPast(4, 3)).toBe(false);
  });
});
