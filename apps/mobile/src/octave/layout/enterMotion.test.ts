import { describe, expect, it, vi } from "vitest";

vi.mock("react-native-reanimated", () => ({ Easing: { out: () => () => 0, cubic: () => 0 }, FadeInDown: {} }));

const { STAGGER_MAX_ITEMS, STAGGER_MS, staggerDelay } = await import("./enterMotion");

describe("apparition des contenus", () => {
  it("décale les premières cartes, d'un pas court", () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(1)).toBe(STAGGER_MS);
    expect(staggerDelay(STAGGER_MAX_ITEMS - 1)).toBe((STAGGER_MAX_ITEMS - 1) * STAGGER_MS);
  });

  it("ne fait jamais attendre : au-delà de la première vue, rien ne s'anime", () => {
    expect(staggerDelay(STAGGER_MAX_ITEMS)).toBeNull();
    expect(staggerDelay(400)).toBeNull();
    expect(staggerDelay(-1)).toBeNull();
    // La dernière carte animée part en moins de 300 ms.
    expect((STAGGER_MAX_ITEMS - 1) * STAGGER_MS).toBeLessThan(300);
  });
});
