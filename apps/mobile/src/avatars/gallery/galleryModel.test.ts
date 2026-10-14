import { describe, expect, it } from "vitest";
import { AVATAR_CHARACTERS } from "@tentacle-tv/shared";
import { galleryLayout } from "./galleryLayout";
import { restOf, TEMPERAMENT_MOTION } from "./temperamentMotion";

describe("la grille de la galerie", () => {
  it("trois colonnes sur tout téléphone, du plus petit au plus grand", () => {
    for (const width of [320, 375, 393, 430]) {
      const layout = galleryLayout(width, false);
      expect(layout.columns).toBe(3);
      expect(layout.tileWidth).toBeGreaterThanOrEqual(44);
      expect(layout.art).toBeGreaterThan(60);
      expect(layout.art).toBeLessThanOrEqual(88);
    }
  });

  it("plus de colonnes sur une tablette, sans jamais déborder de la feuille", () => {
    for (const width of [520, 700, 1024]) {
      const layout = galleryLayout(width, true);
      expect(layout.columns).toBeGreaterThanOrEqual(4);
      expect(layout.columns).toBeLessThanOrEqual(6);
      expect(layout.columns * layout.tileWidth + 12 * (layout.columns - 1)).toBeLessThanOrEqual(width - 40);
    }
  });
});

describe("le tempérament en geste", () => {
  it("chaque personnage a le sien, qui finit au repos et ne dure pas", () => {
    for (const { temperament } of AVATAR_CHARACTERS) {
      const motion = TEMPERAMENT_MOTION[temperament];
      expect(motion.values.at(-1)).toBe(restOf(motion.property));
      expect(motion.values.length * motion.stepMs).toBeLessThanOrEqual(800);
    }
  });
});
