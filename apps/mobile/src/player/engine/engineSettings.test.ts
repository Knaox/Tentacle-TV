import { describe, expect, it } from "vitest";
import type { StorageAdapter } from "@tentacle-tv/api-client";
import { configureEngineSettings, getEngineSettings, setEngineSetting } from "./engineSettings";

function memoryStorage(seed: Record<string, string> = {}): StorageAdapter & { data: Map<string, string> } {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
  } as StorageAdapter & { data: Map<string, string> };
}

describe("réglage « Adapter la fréquence de l'écran »", () => {
  it("est allumé par défaut", () => {
    configureEngineSettings(memoryStorage());
    expect(getEngineSettings().matchFrameRate).toBe(true);
  });

  it("se coupe, n'écrit que « 0 », et se rallume en effaçant la clé", () => {
    const storage = memoryStorage();
    configureEngineSettings(storage);
    setEngineSetting("matchFrameRate", false);
    expect(storage.data.get("tentacle_match_frame_rate")).toBe("0");
    configureEngineSettings(storage);
    expect(getEngineSettings().matchFrameRate).toBe(false);
    setEngineSetting("matchFrameRate", true);
    expect(storage.data.has("tentacle_match_frame_rate")).toBe(false);
  });
});
