import { describe, expect, it } from "vitest";
import {
  BEFORE_END_DEFAULT,
  DEFAULT_PLAYBACK_SETTINGS,
  NEXT_BEFORE_END_SECONDS_MAX,
  NEXT_COUNTDOWN_DEFAULT_MS,
  NEXT_COUNTDOWN_MAX_MS,
  NEXT_COUNTDOWN_MIN_MS,
  SEGMENT_AUTO_DELAY_MAX_MS,
  beforeEndPositionMs,
  normalizePlaybackSettings,
  resolveBeforeEnd,
} from "./playbackSettings";

describe("DEFAULT_PLAYBACK_SETTINGS", () => {
  it("porte les défauts validés : début et aperçu automatiques, résumé et générique proposés", () => {
    expect(DEFAULT_PLAYBACK_SETTINGS.intro.action).toBe("auto");
    expect(DEFAULT_PLAYBACK_SETTINGS.preview.action).toBe("auto");
    expect(DEFAULT_PLAYBACK_SETTINGS.recap.action).toBe("button");
    expect(DEFAULT_PLAYBACK_SETTINGS.outro.action).toBe("button");
    // Cinq secondes : le décompte doit se voir sans qu'on guette l'écran.
    expect(DEFAULT_PLAYBACK_SETTINGS.intro.autoDelayMs).toBe(5_000);
    expect(DEFAULT_PLAYBACK_SETTINGS.next).toMatchObject({
      nextCard: true,
      nextCountdown: true,
      nextAutoPlay: true,
      nextFinalCard: true,
      nextTrigger: "outroStart",
      beforeEndEnabled: true,
      beforeEndRules: [],
    });
    expect(DEFAULT_PLAYBACK_SETTINGS.next.beforeEndDefault).toEqual(BEFORE_END_DEFAULT);
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
      next: { nextTrigger: "jamais", beforeEndDefault: { mode: "ailleurs", value: "45" } },
    });
    expect(settings.intro).toEqual(DEFAULT_PLAYBACK_SETTINGS.intro);
    expect(settings.next.nextTrigger).toBe("outroStart");
    expect(settings.next.beforeEndDefault).toEqual(BEFORE_END_DEFAULT);
  });

  it("borne les nombres et arrondit", () => {
    const settings = normalizePlaybackSettings({
      recap: { autoDelayMs: 999_999.9 },
      preview: { autoDelayMs: -50 },
      next: { beforeEndDefault: { mode: "seconds", value: 10_000 } },
    });
    expect(settings.recap.autoDelayMs).toBe(SEGMENT_AUTO_DELAY_MAX_MS);
    expect(settings.preview.autoDelayMs).toBe(0);
    expect(settings.next.beforeEndDefault.value).toBe(NEXT_BEFORE_END_SECONDS_MAX);
  });

  it("borne la durée du décompte « épisode suivant »", () => {
    const of = (raw: unknown) =>
      normalizePlaybackSettings({ next: { nextCountdownMs: raw } }).next.nextCountdownMs;
    expect(of(2_500)).toBe(2_500);
    // Hors bornes, illisible ou absente : le défaut livré, jamais une exception.
    expect(of(50)).toBe(NEXT_COUNTDOWN_MIN_MS);
    expect(of(999_999)).toBe(NEXT_COUNTDOWN_MAX_MS);
    expect(of("dix secondes")).toBe(NEXT_COUNTDOWN_DEFAULT_MS);
    expect(of(undefined)).toBe(NEXT_COUNTDOWN_DEFAULT_MS);
  });

  it("l'affiche de fin : défaut vrai, un cache d'avant ou un booléen farfelu retombent sur vrai", () => {
    const of = (raw: unknown) =>
      normalizePlaybackSettings({ next: { nextFinalCard: raw } }).next.nextFinalCard;
    expect(of(false)).toBe(false);
    // Un cache d'avant la 1.20.11 ne porte pas le champ : l'affiche reste due.
    expect(of(undefined)).toBe(true);
    expect(of("non")).toBe(true);
  });

  it("des réglages déjà sains ressortent inchangés", () => {
    const sane = {
      intro: { action: "off", countdownVisible: false, autoDelayMs: 1_500 },
      outro: { action: "auto", countdownVisible: true, autoDelayMs: 5_000 },
      outroFilm: { action: "off", countdownVisible: false, autoDelayMs: 0 },
      recap: { action: "button", countdownVisible: true, autoDelayMs: 3_000 },
      preview: { action: "off", countdownVisible: true, autoDelayMs: 3_000 },
      next: {
        nextCard: false,
        nextCountdown: true,
        nextCountdownMs: 7_500,
        nextAutoPlay: false,
        nextFinalCard: false,
        nextTrigger: "beforeEnd",
        beforeEndEnabled: true,
        beforeEndDefault: { mode: "seconds", value: 90 },
        beforeEndRules: [{ libraryIds: ["lib-1"], mode: "percent", value: 95 }],
      },
    } as const;
    expect(normalizePlaybackSettings(sane)).toEqual(sane);
  });
});

describe("le repli « avant la fin »", () => {
  const next = (patch: Partial<typeof DEFAULT_PLAYBACK_SETTINGS.next> = {}) => ({
    ...DEFAULT_PLAYBACK_SETTINGS.next,
    ...patch,
  });

  it("éteint, il ne rend rien — la fin d'un épisode reste nue", () => {
    expect(resolveBeforeEnd(next({ beforeEndEnabled: false }), "lib-1")).toBeNull();
  });

  it("sans règle qui vise, c'est le seuil global — 98 % du média", () => {
    expect(resolveBeforeEnd(next(), "lib-1")).toEqual({ mode: "percent", value: 98 });
    expect(resolveBeforeEnd(next(), null)).toEqual({ mode: "percent", value: 98 });
  });

  it("une règle ciblée bat le seuil global, et la PREMIÈRE qui vise gagne", () => {
    const settings = next({
      beforeEndRules: [
        { libraryIds: ["series", "series-2"], mode: "percent", value: 96 },
        { libraryIds: ["anime"], mode: "seconds", value: 15 },
        { libraryIds: ["anime"], mode: "seconds", value: 99 },
      ],
    });
    expect(resolveBeforeEnd(settings, "series-2")).toEqual({ mode: "percent", value: 96 });
    expect(resolveBeforeEnd(settings, "anime")).toEqual({ mode: "seconds", value: 15 });
    expect(resolveBeforeEnd(settings, "films")).toEqual({ mode: "percent", value: 98 });
  });

  it("le seuil se convertit en position, chacun dans son unité", () => {
    const runtime = 1_400_000; // 23 min 20
    expect(beforeEndPositionMs({ mode: "percent", value: 98 }, runtime)).toBe(1_372_000);
    expect(beforeEndPositionMs({ mode: "seconds", value: 15 }, runtime)).toBe(1_385_000);
    // Durée inconnue : on ne devine pas une fin qu'on ne connaît pas.
    expect(beforeEndPositionMs({ mode: "percent", value: 98 }, 0)).toBeNull();
  });

  it("une règle sans bibliothèque ne survit pas à la normalisation", () => {
    const settings = normalizePlaybackSettings({
      next: { beforeEndRules: [{ libraryIds: [], mode: "percent", value: 90 }] },
    });
    expect(settings.next.beforeEndRules).toEqual([]);
  });

  it("un cache d'avant la refonte garde SON seuil, converti en secondes", () => {
    const settings = normalizePlaybackSettings({ next: { nextBeforeEndSeconds: 90 } });
    expect(settings.next.beforeEndDefault).toEqual({ mode: "seconds", value: 90 });
  });
});
