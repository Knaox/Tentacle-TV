import { describe, expect, it, vi } from "vitest";
import type { DeviceStorage } from "../player/deviceSettings";
import { DEFAULT_PLAYBACK_SETTINGS, type PlaybackSettings } from "./playbackSettings";
import {
  SETTINGS_CACHE_KEY,
  createPlaybackSettingsStore,
  seedFromLegacyDeviceKeys,
} from "./playbackSettingsStore";

function fakeStorage(initial: Record<string, string> = {}): DeviceStorage & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

const SERVER_SETTINGS: PlaybackSettings = {
  ...DEFAULT_PLAYBACK_SETTINGS,
  intro: { action: "button", countdownVisible: true, autoDelayMs: 5_000 },
};

describe("seedFromLegacyDeviceKeys", () => {
  it("clés vierges : les défauts, tels quels", () => {
    expect(seedFromLegacyDeviceKeys(() => null)).toEqual(DEFAULT_PLAYBACK_SETTINGS);
  });

  it("les refus historiques sont convertis — et l'ancienne clé du décompte coupe l'acte aussi", () => {
    const seed = seedFromLegacyDeviceKeys((key) =>
      key === "tentacle_auto_skip_intro" || key === "tentacle_up_next_countdown" ? "false" : null,
    );
    expect(seed.intro.action).toBe("button");
    expect(seed.next).toMatchObject({ nextCountdown: false, nextAutoPlay: false, nextCard: true });
  });
});

describe("createPlaybackSettingsStore", () => {
  it("répond HORS LIGNE depuis le cache local, sans exiger le serveur", async () => {
    const storage = fakeStorage({
      [SETTINGS_CACHE_KEY]: JSON.stringify(SERVER_SETTINGS),
    });
    const store = createPlaybackSettingsStore({
      storage,
      readRemote: async () => {
        throw new Error("hors ligne");
      },
      writeRemote: async () => {},
    });
    expect(store.readSnapshot().intro.autoDelayMs).toBe(5_000);
    await store.resync(); // ne jette pas, ne change rien
    expect(store.readSnapshot().intro.autoDelayMs).toBe(5_000);
  });

  it("resync aligne sur le serveur et prévient les abonnés", async () => {
    const storage = fakeStorage();
    const store = createPlaybackSettingsStore({
      storage,
      readRemote: async () => ({ stored: true, settings: SERVER_SETTINGS }),
      writeRemote: async () => {},
    });
    const callback = vi.fn();
    store.subscribe(callback);
    await store.resync();
    expect(store.readSnapshot()).toEqual(SERVER_SETTINGS);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storage.data.get(SETTINGS_CACHE_KEY) ?? "")).toEqual(SERVER_SETTINGS);
  });

  it("définir fusionne en profondeur, écrit le cache et pousse au serveur", async () => {
    const writes: PlaybackSettings[] = [];
    const storage = fakeStorage();
    const store = createPlaybackSettingsStore({
      storage,
      readRemote: async () => ({ stored: true, settings: DEFAULT_PLAYBACK_SETTINGS }),
      writeRemote: async (r) => void writes.push(r),
    });
    store.set({ next: { nextAutoPlay: false } });
    await Promise.resolve();
    expect(store.readSnapshot().next).toMatchObject({ nextAutoPlay: false, nextCard: true });
    expect(store.readSnapshot().intro).toEqual(DEFAULT_PLAYBACK_SETTINGS.intro);
    expect(writes).toHaveLength(1);
  });

  it("PUT en échec : la valeur locale reste, et se re-pousse au resync suivant", async () => {
    let failing = true;
    const writes: PlaybackSettings[] = [];
    const store = createPlaybackSettingsStore({
      storage: fakeStorage(),
      readRemote: async () => ({ stored: true, settings: SERVER_SETTINGS }),
      writeRemote: async (r) => {
        if (failing) throw new Error("500");
        writes.push(r);
      },
    });
    store.set({ outro: { action: "auto" } });
    await Promise.resolve();
    expect(store.readSnapshot().outro.action).toBe("auto");

    failing = false;
    await store.resync(); // re-pousse au lieu de se faire écraser
    expect(writes).toHaveLength(1);
    expect(writes[0].outro.action).toBe("auto");
    expect(store.readSnapshot().outro.action).toBe("auto");
  });

  it("semis : un refus hérité est converti et poussé quand le serveur ne connaît rien", async () => {
    const writes: PlaybackSettings[] = [];
    const storage = fakeStorage({ tentacle_up_next_card: "false" });
    const store = createPlaybackSettingsStore({
      storage,
      readRemote: async () => ({ stored: false, settings: DEFAULT_PLAYBACK_SETTINGS }),
      writeRemote: async (r) => void writes.push(r),
    });
    await store.resync();
    expect(store.readSnapshot().next.nextCard).toBe(false);
    expect(writes).toHaveLength(1);
    expect(writes[0].next.nextCard).toBe(false);
  });

  it("semis : des clés vierges ne poussent RIEN — un autre appareil garde le droit de semer", async () => {
    const writes: PlaybackSettings[] = [];
    const store = createPlaybackSettingsStore({
      storage: fakeStorage(),
      readRemote: async () => ({ stored: false, settings: DEFAULT_PLAYBACK_SETTINGS }),
      writeRemote: async (r) => void writes.push(r),
    });
    await store.resync();
    expect(store.readSnapshot()).toEqual(DEFAULT_PLAYBACK_SETTINGS);
    expect(writes).toHaveLength(0);
  });

  it("une réponse méconnaissable ne touche à rien", async () => {
    const storage = fakeStorage({ [SETTINGS_CACHE_KEY]: JSON.stringify(SERVER_SETTINGS) });
    const store = createPlaybackSettingsStore({
      storage,
      readRemote: async () => "<html>proxy</html>",
      writeRemote: async () => {},
    });
    await store.resync();
    expect(store.readSnapshot()).toEqual(SERVER_SETTINGS);
  });

  it("rehydrate relit un cache rempli après coup (hydrate() Android TV)", () => {
    const storage = fakeStorage();
    const store = createPlaybackSettingsStore({
      storage,
      readRemote: async () => ({ stored: true, settings: DEFAULT_PLAYBACK_SETTINGS }),
      writeRemote: async () => {},
    });
    expect(store.readSnapshot()).toEqual(DEFAULT_PLAYBACK_SETTINGS);
    storage.data.set(SETTINGS_CACHE_KEY, JSON.stringify(SERVER_SETTINGS));
    store.rehydrate();
    expect(store.readSnapshot()).toEqual(SERVER_SETTINGS);
  });
});
