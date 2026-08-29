import { describe, expect, it } from "vitest";
import { DEFAULT_PLAYBACK_SETTINGS, normalizePlaybackSettings } from "./playbackSettings";
import { detectPreset, presetSettings, SELECTABLE_PRESETS } from "./playbackPresets";

describe("les préréglages de lecture", () => {
  it("chaque mode se relit tel qu'il s'est écrit", () => {
    for (const preset of SELECTABLE_PRESETS) {
      expect(detectPreset(presetSettings(preset))).toBe(preset);
    }
  });

  it("un mode reste un mode après passage par la normalisation", () => {
    for (const preset of SELECTABLE_PRESETS) {
      expect(detectPreset(normalizePlaybackSettings(presetSettings(preset)))).toBe(preset);
    }
  });

  it("un seul champ qui s'écarte, et c'est « personnalisé » — l'étiquette ne ment pas", () => {
    const settings = presetSettings("automatic");
    settings.recap.action = "off";
    expect(detectPreset(settings)).toBe("custom");

    const autreDelai = presetSettings("manual");
    autreDelai.intro.autoDelayMs = 4_500;
    expect(detectPreset(autreDelai)).toBe("custom");
  });

  it("MANUEL ne fait jamais rien tout seul, mais propose toujours la suite", () => {
    const manual = presetSettings("manual");
    for (const passage of [manual.intro, manual.outro, manual.recap, manual.preview]) {
      expect(passage.action).toBe("button");
    }
    expect(manual.next).toMatchObject({ nextCard: true, nextCountdown: false, nextAutoPlay: false });
  });

  it("AUTOMATIQUE passe les quatre passages et enchaîne", () => {
    const automatic = presetSettings("automatic");
    for (const passage of [automatic.intro, automatic.outro, automatic.recap, automatic.preview]) {
      expect(passage.action).toBe("auto");
    }
    expect(automatic.next).toMatchObject({ nextCard: true, nextCountdown: true, nextAutoPlay: true });
  });

  it("écrire un mode ne rend pas l'autre : les objets sont indépendants", () => {
    const a = presetSettings("manual");
    a.intro.action = "off";
    expect(presetSettings("manual").intro.action).toBe("button");
  });

  it("les défauts livrés ne sont ni l'un ni l'autre — ils restent « personnalisé »", () => {
    // Défaut : intro auto, générique en bouton, récap et aperçu éteints.
    expect(detectPreset(DEFAULT_PLAYBACK_SETTINGS)).toBe("custom");
  });
});
