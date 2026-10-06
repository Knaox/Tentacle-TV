import { describe, expect, it } from "vitest";
import fr from "./locales/fr/common";
import en from "./locales/en/common";

/**
 * « Reprendre la lecture » titrait la rangée de l'accueil et l'accroche du
 * héros, juste au-dessus d'un bouton « Reprendre » : le même mot deux fois.
 * Le titre ne redit jamais le verbe du bouton, dans aucune langue.
 */
describe("titre de la rangée des titres entamés", () => {
  it("ne répète pas le bouton « Reprendre »", () => {
    expect(fr.resumeWatching.toLowerCase()).not.toContain(fr.resume.toLowerCase());
    expect(en.resumeWatching.toLowerCase()).not.toContain(en.resume.toLowerCase());
  });

  it("existe dans les deux langues", () => {
    expect(fr.resumeWatching.trim()).not.toBe("");
    expect(en.resumeWatching.trim()).not.toBe("");
  });
});
