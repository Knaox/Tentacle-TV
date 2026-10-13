/** Un réglage d'appareil : seul l'écart au défaut s'écrit, un stockage refusé ne casse rien. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDeviceFlag } from "./deviceFlag";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createDeviceFlag", () => {
  it("lit le défaut, n'écrit que l'écart, efface au retour au défaut", () => {
    const storage = fakeStorage();
    vi.stubGlobal("localStorage", storage);
    const flag = createDeviceFlag("tentacle_trailer_previews", true);
    expect(flag.get()).toBe(true);
    const listener = vi.fn();
    flag.subscribe(listener);
    flag.set(false);
    expect(storage.data.get("tentacle_trailer_previews")).toBe("0");
    expect(listener).toHaveBeenCalledTimes(1);
    flag.set(false);
    expect(listener).toHaveBeenCalledTimes(1);
    flag.set(true);
    expect(storage.data.has("tentacle_trailer_previews")).toBe(false);
  });

  it("relit ce qui a été écrit", () => {
    vi.stubGlobal("localStorage", fakeStorage({ tentacle_trailer_preview_muted: "1" }));
    expect(createDeviceFlag("tentacle_trailer_preview_muted", false).get()).toBe(true);
  });

  it("un stockage refusé : le défaut, puis le réglage pour la session", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    });
    const flag = createDeviceFlag("tentacle_trailer_previews", true);
    expect(flag.get()).toBe(true);
    flag.set(false);
    expect(flag.get()).toBe(false);
  });
});
