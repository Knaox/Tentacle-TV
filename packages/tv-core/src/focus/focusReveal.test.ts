import { describe, expect, it } from "vitest";
import { FOCUS_HOLD_MS, FOCUS_REVEAL_DELAY_MS, FOCUS_REVEAL_MAX_MS, qualityBadgesShown, qualityReadDue } from "./focusReveal";

describe("ce qui paraît au focus — tout de suite, en un fondu bref", () => {
  it("aucune attente avant d'apparaître ; une apparition de 150 ms au plus", () => {
    expect(FOCUS_REVEAL_DELAY_MS).toBe(0);
    expect(FOCUS_REVEAL_MAX_MS).toBeLessThanOrEqual(150);
  });

  it("le focus qui tient (lecture, flou coûteux) dure plus qu'un pas de balayage (100 à 250 ms)", () => {
    expect(FOCUS_HOLD_MS).toBe(300);
  });
});

describe("les badges de qualité — la lecture attend, l'apparition jamais", () => {
  it("connus (modèle ou déjà lus) : au focus, sans attendre", () => {
    expect(qualityBadgesShown({ focused: true, known: true })).toBe(true);
  });

  it("pas encore connus, ou focus parti : rien", () => {
    expect(qualityBadgesShown({ focused: true, known: false })).toBe(false);
    expect(qualityBadgesShown({ focused: false, known: true })).toBe(false);
  });

  it("la lecture ne part que pour un titre à lire, quand le focus a tenu", () => {
    expect(qualityReadDue({ needsRead: true, held: true })).toBe(true);
    expect(qualityReadDue({ needsRead: true, held: false })).toBe(false);
    expect(qualityReadDue({ needsRead: false, held: true })).toBe(false);
  });
});
