import { describe, expect, it } from "vitest";
import enWizard from "../i18n/locales/en/setupWizard";
import frWizard from "../i18n/locales/fr/setupWizard";
import { SETUP_DOC_PATHS } from "./setupDocLinks";
import { SETUP_HELP, setupHelpTopic } from "./setupHelp";

describe("« Besoin d'aide ? » de l'assistant", () => {
  it("chaque question de chaque écran a sa question et sa réponse, en français et en anglais", () => {
    for (const [step, ids] of Object.entries(SETUP_HELP)) {
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) {
        for (const suffix of ["q", "a"]) {
          const key = `help_${step}_${id}_${suffix}`;
          expect(frWizard, key).toHaveProperty(key);
          expect(enWizard, key).toHaveProperty(key);
        }
      }
    }
  });

  it("chaque écran renvoie vers sa page du site ; les bibliothèques d'un Jellyfin configuré vide, vers leur ancre ; la clé TMDB, nulle part", () => {
    for (const step of Object.keys(SETUP_HELP) as Array<keyof typeof SETUP_HELP>) {
      const topic = setupHelpTopic(step, false);
      if (step === "tmdb") expect(topic).toBeNull();
      else expect(topic && SETUP_DOC_PATHS[topic]).toBeTruthy();
    }
    expect(setupHelpTopic("libraries", true)).toBe("librariesExistingEmpty");
    expect(setupHelpTopic("remote", true)).toBe("remote");
  });
});
