import { describe, expect, it, vi } from "vitest";
import { createStillWatchingStore, STILL_WATCHING_CACHE_KEY } from "./stillWatchingStore";
import { DEFAULT_STILL_WATCHING_SETTINGS } from "./stillWatchingSettings";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value), data };
}

describe("« Vous regardez encore ? » — le magasin", () => {
  it("sans copie locale : les défauts, et la fonction se tait tant que le serveur n'a rien dit", () => {
    const store = createStillWatchingStore({ storage: memoryStorage(), readRemote: vi.fn(), writeRemote: vi.fn() });
    expect(store.readSnapshot()).toEqual({ supported: false, settings: DEFAULT_STILL_WATCHING_SETTINGS });
  });

  it("le compte relu fait foi, et la copie locale le garde pour le hors ligne", async () => {
    const storage = memoryStorage();
    const remote = { stored: true, settings: { enabled: false, afterMs: 3_600_000, countdownMs: 30_000 } };
    const store = createStillWatchingStore({ storage, readRemote: async () => remote, writeRemote: vi.fn() });
    await store.resync();
    expect(store.readSnapshot()).toEqual({ supported: true, settings: remote.settings });
    // Un nouvel appareil hors ligne lit la copie.
    const offline = createStillWatchingStore({ storage, readRemote: () => Promise.reject(new Error("hors ligne")), writeRemote: vi.fn() });
    await offline.resync();
    expect(offline.readSnapshot()).toEqual({ supported: true, settings: remote.settings });
  });

  it("une écriture est optimiste, et re-poussée si le serveur était injoignable", async () => {
    const writeRemote = vi.fn().mockRejectedValueOnce(new Error("réseau")).mockResolvedValue(undefined);
    const readRemote = vi.fn();
    const store = createStillWatchingStore({ storage: memoryStorage(), readRemote, writeRemote });
    store.set({ enabled: false });
    expect(store.readSnapshot().settings.enabled).toBe(false);
    await Promise.resolve();
    await store.resync();
    expect(writeRemote).toHaveBeenCalledTimes(2);
    expect(readRemote).not.toHaveBeenCalled();
  });

  it("un serveur qui ne déclare pas la capacité éteint la fonction, copie comprise", async () => {
    const storage = memoryStorage({ [STILL_WATCHING_CACHE_KEY]: JSON.stringify({ supported: true, settings: DEFAULT_STILL_WATCHING_SETTINGS }) });
    const store = createStillWatchingStore({ storage, readRemote: vi.fn(), writeRemote: vi.fn() });
    expect(store.readSnapshot().supported).toBe(true);
    store.markUnsupported();
    expect(store.readSnapshot().supported).toBe(false);
    expect(JSON.parse(storage.data.get(STILL_WATCHING_CACHE_KEY) as string).supported).toBe(false);
  });
});
