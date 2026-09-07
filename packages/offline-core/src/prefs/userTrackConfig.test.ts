import { describe, expect, it } from "vitest";
import type { KeyValueStore } from "./trackPrefsCache";
import { cacheUserTrackConfig, parseUserTrackConfig, readUserTrackConfig, resolveWithUserConfig, userTrackConfigKey } from "./userTrackConfig";

function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return { get: (k) => map.get(k) ?? null, set: (k, v) => void map.set(k, v), remove: (k) => void map.delete(k) };
}

const audio = [
  { index: 1, language: "jpn", isDefault: true },
  { index: 2, language: "fre" },
];
const subs = [
  { index: 3, language: "fre", isForced: true, title: "Forced" },
  { index: 4, language: "fre" },
  { index: 5, language: "eng" },
];

describe("parseUserTrackConfig", () => {
  it("lit la Configuration du compte, chaînes vides → null, mode inconnu → Default", () => {
    expect(parseUserTrackConfig({
      Id: "u", Configuration: { AudioLanguagePreference: "jpn", SubtitleLanguagePreference: "", SubtitleMode: "Smart", PlayDefaultAudioTrack: false },
    })).toEqual({ audioLang: "jpn", subtitleLang: null, subtitleMode: "Smart", playDefaultAudioTrack: false });
    expect(parseUserTrackConfig({ Configuration: { SubtitleMode: "Bizarre" } })?.subtitleMode).toBe("Default");
    expect(parseUserTrackConfig({ Id: "u" })).toBeNull();
    expect(parseUserTrackConfig(null)).toBeNull();
  });
});

describe("cache", () => {
  it("écrit et relit sous la clé du compte", () => {
    const store = memoryStore();
    cacheUserTrackConfig(store, "u1", { audioLang: "fre", subtitleLang: "eng", subtitleMode: "Always", playDefaultAudioTrack: true });
    expect(store.get(userTrackConfigKey("u1"))).not.toBeNull();
    expect(readUserTrackConfig(store, "u1")).toEqual({ audioLang: "fre", subtitleLang: "eng", subtitleMode: "Always", playDefaultAudioTrack: true });
    expect(readUserTrackConfig(store, "u2")).toBeNull();
    store.set(userTrackConfigKey("u3"), "{pas du json");
    expect(readUserTrackConfig(store, "u3")).toBeNull();
  });
});

describe("resolveWithUserConfig", () => {
  const base = { audioLang: "fre", subtitleLang: "fre", playDefaultAudioTrack: false } as const;

  it("Always, OnlyForced, None, Default suivent le résolveur partagé", () => {
    expect(resolveWithUserConfig({ ...base, subtitleMode: "Always" }, "u", "lib", audio, subs)).toEqual({ audioIndex: 2, subtitleIndex: 4 });
    expect(resolveWithUserConfig({ ...base, subtitleMode: "OnlyForced" }, "u", "lib", audio, subs)).toEqual({ audioIndex: 2, subtitleIndex: 3 });
    expect(resolveWithUserConfig({ ...base, subtitleMode: "None" }, "u", "lib", audio, subs).subtitleIndex).toBeNull();
    expect(resolveWithUserConfig({ ...base, subtitleMode: "Default" }, "u", "lib", audio, subs).subtitleIndex).toBe(3);
  });

  it("Smart : audio déjà dans la langue voulue → forcés seulement ; sinon sous-titres complets", () => {
    expect(resolveWithUserConfig({ ...base, subtitleMode: "Smart" }, "u", "lib", audio, subs)).toEqual({ audioIndex: 2, subtitleIndex: 3 });
    const japanese = resolveWithUserConfig({ audioLang: "jpn", subtitleLang: "fre", subtitleMode: "Smart", playDefaultAudioTrack: false }, "u", "lib", audio, subs);
    expect(japanese).toEqual({ audioIndex: 1, subtitleIndex: 4 });
  });

  it("« piste audio par défaut » n'impose pas de langue audio", () => {
    const resolved = resolveWithUserConfig({ ...base, subtitleMode: "None", playDefaultAudioTrack: true }, "u", "lib", audio, subs);
    expect(resolved.audioIndex).toBe(1);
  });
});
