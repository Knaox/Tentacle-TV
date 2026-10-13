import { describe, expect, it } from "vitest";
import fr from "./locales/fr/trailerPreview";
import en from "./locales/en/trailerPreview";

/**
 * Les mots de l'aperçu de bande-annonce au survol : le réglage et la
 * mini-carte existent dans les deux langues, avec les mêmes clés ; le nom de
 * la mini-carte porte le titre ; la ponctuation française garde son espace
 * insécable.
 */
describe("vocabulaire de l'aperçu de bande-annonce", () => {
  it("les mêmes clés dans les deux langues, aucune vide", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
    for (const [key, value] of [...Object.entries(fr), ...Object.entries(en)]) {
      expect(value.trim(), key).not.toBe("");
    }
  });

  it("le nom de la mini-carte dit le titre", () => {
    expect(fr.previewLabel.replace("{{title}}", "Metropolis")).toBe("Aperçu de la bande-annonce de Metropolis");
    expect(en.previewLabel.replace("{{title}}", "Metropolis")).toBe("Trailer preview for Metropolis");
  });

  it("une espace insécable devant les deux-points, jamais une espace ordinaire", () => {
    for (const value of Object.values(fr)) expect(value).not.toMatch(/ [:;?!]/);
    expect(fr.settingDescription).toContain(" :");
  });
});
