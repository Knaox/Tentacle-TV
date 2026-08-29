import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAYBACK_SETTINGS,
  NEXT_BEFORE_END_SECONDS_MAX,
  SEGMENT_AUTO_DELAY_MAX_MS,
  normalizePlaybackSettings,
} from "./playbackSettings";

describe("DEFAULT_PLAYBACK_SETTINGS", () => {
  it("porte les défauts validés : intro auto, générique bouton, récap/aperçu éteints", () => {
    expect(DEFAULT_PLAYBACK_SETTINGS.intro.action).toBe("auto");
    expect(DEFAULT_PLAYBACK_SETTINGS.outro.action).toBe("button");
    expect(DEFAULT_PLAYBACK_SETTINGS.recap.action).toBe("off");
    expect(DEFAULT_PLAYBACK_SETTINGS.preview.action).toBe("off");
    expect(DEFAULT_PLAYBACK_SETTINGS.next).toMatchObject({
      nextCard: true,
      nextCountdown: true,
      nextAutoPlay: true,
      nextTrigger: "outroStart",
    });
  });
});

describe("normalizePlaybackSettings", () => {
  it("rien du tout : les défauts, en copie neuve", () => {
    const a = normalizePlaybackSettings(undefined);
    const b = normalizePlaybackSettings(null);
    expect(a).toEqual(DEFAULT_PLAYBACK_SETTINGS);
    expect(b).toEqual(DEFAULT_PLAYBACK_SETTINGS);
    expect(a.intro).not.toBe(DEFAULT_PLAYBACK_SETTINGS.intro);
  });

  it("réponse partielle : chaque champ absent retombe sur son défaut", () => {
    const settings = normalizePlaybackSettings({
      outro: { action: "auto" },
      next: { nextAutoPlay: false },
    });
    expect(settings.outro).toMatchObject({ action: "auto", countdownVisible: true });
    expect(settings.intro.action).toBe("auto");
    expect(settings.next).toMatchObject({ nextAutoPlay: false, nextCard: true, nextCountdown: true });
  });

  it("valeurs farfelues : action inconnue, booléen chaîne, nombre infini", () => {
    const settings = normalizePlaybackSettings({
      intro: { action: "banana", countdownVisible: "oui", autoDelayMs: Infinity },
      next: { nextTrigger: "jamais", nextBeforeEndSeconds: "45" },
    });
    expect(settings.intro).toEqual(DEFAULT_PLAYBACK_SETTINGS.intro);
    expect(settings.next.nextTrigger).toBe("outroStart");
    expect(settings.next.nextBeforeEndSeconds).toBe(45);
  });

  it("borne les nombres et arrondit", () => {
    const settings = normalizePlaybackSettings({
      recap: { autoDelayMs: 999_999.9 },
      preview: { autoDelayMs: -50 },
      next: { nextBeforeEndSeconds: 10_000 },
    });
    expect(settings.recap.autoDelayMs).toBe(SEGMENT_AUTO_DELAY_MAX_MS);
    expect(settings.preview.autoDelayMs).toBe(0);
    expect(settings.next.nextBeforeEndSeconds).toBe(NEXT_BEFORE_END_SECONDS_MAX);
  });

  it("des réglages déjà sains ressortent inchangés", () => {
    const sane = {
      intro: { action: "off", countdownVisible: false, autoDelayMs: 1_500 },
      outro: { action: "auto", countdownVisible: true, autoDelayMs: 5_000 },
      recap: { action: "button", countdownVisible: true, autoDelayMs: 3_000 },
      preview: { action: "off", countdownVisible: true, autoDelayMs: 3_000 },
      next: {
        nextCard: false,
        nextCountdown: true,
        nextAutoPlay: false,
        nextTrigger: "beforeEnd",
        nextBeforeEndSeconds: 90,
      },
    } as const;
    expect(normalizePlaybackSettings(sane)).toEqual(sane);
  });
});
