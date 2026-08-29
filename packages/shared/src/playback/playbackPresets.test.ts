import { describe, expect, it } from "vitest";
import { DEFAULT_PLAYBACK_SETTINGS, normalizePlaybackSettings } from "./playbackSettings";
import {
  PRESET_HINT_KEYS,
  PRESET_LABEL_KEYS,
  SELECTABLE_PRESETS,
  detectPreset,
  presetSettings,
} from "./playbackPresets";

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

  it("les défauts livrés SONT le mode « Par défaut » — un seul jeu de valeurs", () => {
    // C'est ce qui fait qu'un compte jamais réglé se trouve sur ce mode sans
    // avoir rien fait, et que l'étiquette ne ment pas.
    expect(detectPreset(DEFAULT_PLAYBACK_SETTINGS)).toBe("default");
    expect(presetSettings("default")).toEqual(DEFAULT_PLAYBACK_SETTINGS);
  });

  it("PAR DÉFAUT : début et aperçu automatiques, résumé et générique proposés", () => {
    const preset = presetSettings("default");
    expect(preset.intro).toMatchObject({ action: "auto", autoDelayMs: 5_000, countdownVisible: true });
    expect(preset.preview).toMatchObject({ action: "auto", autoDelayMs: 5_000, countdownVisible: true });
    expect(preset.recap.action).toBe("button");
    expect(preset.outro.action).toBe("button");
    expect(preset.next).toMatchObject({ nextCard: true, nextCountdown: true, nextAutoPlay: true });
  });
});

describe("les clés i18n des modes", () => {
  it("chaque mode a son libellé ET son aide — un mode sans clé s'afficherait vide", () => {
    for (const preset of [...SELECTABLE_PRESETS, "custom"] as const) {
      expect(PRESET_LABEL_KEYS[preset]).toBeTruthy();
      expect(PRESET_HINT_KEYS[preset]).toBeTruthy();
    }
  });

  it("« Par défaut » est PROPOSABLE — c'est le mode d'un compte neuf", () => {
    // Sans lui dans cette liste, les interfaces n'affichaient aucune option
    // cochée pour quelqu'un qui n'avait jamais rien réglé.
    expect(SELECTABLE_PRESETS).toContain("default");
    expect(detectPreset(DEFAULT_PLAYBACK_SETTINGS)).toBe("default");
  });
});
