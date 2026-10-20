import { describe, expect, it } from "vitest";
import { SWIPE_CARD_MAX_WIDTH, swipeCardWidth } from "./swipeCardSize";

describe("swipeCardWidth", () => {
  it("téléphone : la hauteur décide, jamais au-delà de la largeur", () => {
    expect(swipeCardWidth({ w: 390, h: 520 })).toBe(330);
    expect(swipeCardWidth({ w: 320, h: 900 })).toBe(320);
  });

  it("plafond de 420 pt par défaut (« Affiner » inchangé)", () => {
    expect(swipeCardWidth({ w: 800, h: 1000 })).toBe(SWIPE_CARD_MAX_WIDTH);
  });

  it("iPad portrait : la carte suit la hauteur sous le plafond de la colonne", () => {
    // iPad Pro 11 portrait, zone de la pile ≈ 608 × 870 dans la colonne de 640.
    expect(swipeCardWidth({ w: 608, h: 870 }, 608)).toBe(564);
  });

  it("iPad paysage : la hauteur borne la carte", () => {
    expect(swipeCardWidth({ w: 608, h: 520 }, 608)).toBe(330);
  });

  it("rien de mesuré : aucune carte", () => {
    expect(swipeCardWidth({ w: 0, h: 0 })).toBe(0);
  });
});
