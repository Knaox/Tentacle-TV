import { describe, expect, it } from "vitest";
import frPreferences from "../../../../../packages/shared/src/i18n/locales/fr/preferences";
import enPreferences from "../../../../../packages/shared/src/i18n/locales/en/preferences";
import {
  ENGINE_HINT_KEYS, PLAYER_SETTINGS, isPlayerSettingShown, type PlayerSettingId,
} from "./playerSettingsPlatforms";

const ids = Object.keys(PLAYER_SETTINGS) as PlayerSettingId[];
const shown = (platform: "ios" | "android", advancedEngine = true) =>
  ids.filter((id) => isPlayerSettingShown(id, { platform, advancedEngine }));

describe("réglages du lecteur par plateforme", () => {
  it("iPhone : l'Atmos du système, ni sous-titres stylés ni fréquence de l'écran", () => {
    expect(shown("ios")).toEqual([
      "playbackMode", "mediaLanguages", "videoEngine", "preferSystemAtmos", "subtitleScale", "subtitlePosition",
    ]);
  });

  it("Android : sous-titres stylés et fréquence de l'écran, pas d'Atmos du système", () => {
    expect(shown("android")).toEqual([
      "playbackMode", "mediaLanguages", "videoEngine", "styledSubtitlesViaMpv", "matchScreenFrameRate",
      "subtitleScale", "subtitlePosition",
    ]);
  });

  it("sans lecteur avancé : plus de choix de moteur ni de ce qui ne vaut que pour lui", () => {
    expect(shown("ios", false)).toEqual(["playbackMode", "mediaLanguages"]);
    // La fréquence passe par la fenêtre : elle vaut aussi pour le lecteur système.
    expect(shown("android", false)).toEqual(["playbackMode", "mediaLanguages", "matchScreenFrameRate"]);
  });

  it("aucune phrase de moteur Android ne parle d'AirPlay, de Dolby Vision ni d'Atmos", () => {
    for (const [lang, prefs] of [["fr", frPreferences], ["en", enPreferences]] as const) {
      for (const key of Object.values(ENGINE_HINT_KEYS.android)) {
        expect((prefs as Record<string, string>)[key], `${lang}:${key}`).toBeTruthy();
        expect((prefs as Record<string, string>)[key]).not.toMatch(/AirPlay|Dolby|Atmos/i);
      }
      for (const key of Object.values(ENGINE_HINT_KEYS.ios)) expect((prefs as Record<string, string>)[key], `${lang}:${key}`).toBeTruthy();
    }
  });
});
