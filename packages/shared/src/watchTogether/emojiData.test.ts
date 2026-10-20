import { describe, expect, it } from "vitest";
import { EMOJI_CATEGORIES } from "./emojiData";

/**
 * Le sélecteur d'emojis, partagé par le web, le bureau et le mobile : chaque
 * réaction tient dans ce que le serveur accepte (WT_REACTION_MAX_LENGTH, 16
 * unités UTF-16) — sinon elle partirait et serait refusée sans un mot.
 */
describe("EMOJI_CATEGORIES", () => {
  it("chaque emoji tient dans ce que le serveur accepte", () => {
    for (const category of EMOJI_CATEGORIES) {
      for (const emoji of category.emojis) expect(emoji.length, `${category.id} ${emoji}`).toBeLessThanOrEqual(16);
    }
  });

  it("des catégories nommées, jamais vides", () => {
    for (const category of EMOJI_CATEGORIES) {
      expect(category.labelKey).toMatch(/^pickerCat/);
      expect(category.emojis.length).toBeGreaterThan(0);
    }
  });
});
