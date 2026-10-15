import { describe, expect, it } from "vitest";
import {
  ROW_CHROME_HEIGHT,
  cardHeightKey,
  estimateCardHeight,
  reservedCardHeight,
  rowIntrinsicHeight,
} from "./rowTrackReserve";

/**
 * Hauteur réservée d'une piste de rangée. Mesures réelles d'une rangée de
 * « Pour vous » en 1440 × 900 : cartes de 211,33 px de large et 365 px de
 * haut (affiche 317 + bloc titre 48), section de 451 px.
 */
describe("rowTrackReserve", () => {
  it("estime une carte de recommandation au pixel près", () => {
    expect(estimateCardHeight(211.33, "poster")).toBeCloseTo(365, 0);
    expect(rowIntrinsicHeight(estimateCardHeight(211.33, "poster"))).toBe(451);
  });

  it("estime une vignette 16:9", () => {
    expect(estimateCardHeight(320, "episode")).toBe(180 + 48);
  });

  it("préfère la mesure de la rangée, puis celle d'une sœur, puis l'estimation", () => {
    const base = { cardWidth: 211.33, shape: "poster" as const };
    expect(reservedCardHeight({ ...base, measured: 383, sibling: 365 })).toBe(383);
    expect(reservedCardHeight({ ...base, measured: null, sibling: 383 })).toBe(383);
    expect(reservedCardHeight({ ...base, measured: null, sibling: null })).toBeCloseTo(365, 0);
  });

  it("ne réserve rien sans largeur connue (mobile)", () => {
    expect(reservedCardHeight({ cardWidth: null, shape: "poster", measured: 365, sibling: 365 })).toBeNull();
  });

  it("ignore une mesure nulle (piste encore vide)", () => {
    expect(reservedCardHeight({ cardWidth: 200, shape: "poster", measured: 0, sibling: 0 })).toBe(348);
  });

  it("la taille hors écran suit la largeur, plus de 450 px figés", () => {
    // 1920 px de large : des affiches de 260 px.
    expect(rowIntrinsicHeight(estimateCardHeight(260, "poster"))).toBe(ROW_CHROME_HEIGHT + 390 + 48);
  });

  it("deux rangées sœurs partagent une clé au demi-pixel près", () => {
    expect(cardHeightKey("reco", 211.33)).toBe(cardHeightKey("reco", 211.4));
    expect(cardHeightKey("reco", 211.33)).not.toBe(cardHeightKey("poster", 211.33));
  });
});
