import { afterEach, describe, expect, it, vi } from "vitest";
import type { MusicListPrefs } from "@tentacle-tv/shared/music";
import { TentacleApiError } from "../../hooks/usePreferences";
import type { StorageAdapter } from "../../storage";
import { ORDER_OUTBOX_KEY, configureOrderOutbox, flushOrderOutbox, orderOutboxQueue, sendOrderWrite, type OrderOutboxApi } from "./orderOutbox";

function memoryStorage(): StorageAdapter & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

const custom = (keys: string): MusicListPrefs => ({ sort: "custom", direction: "asc", custom: keys.split("").map((k) => ({ k })) });
const keysOf = (prefs: MusicListPrefs) => prefs.custom?.map((e) => e.k).join("");
const offlineError = () => new TypeError("Failed to fetch");

/** Un serveur en mémoire : la préférence et la playlist d'un compte. */
function fakeServer(initial: { prefs?: MusicListPrefs; entries?: string } = {}) {
  let prefs = initial.prefs ?? { sort: "custom", direction: "asc", custom: null };
  let entries = (initial.entries ?? "").split("").filter(Boolean).map((key, i) => ({ entryId: `e${i}`, key }));
  let online = true;
  const reachable = () => {
    if (!online) throw offlineError();
  };
  const api: OrderOutboxApi = {
    prefs: vi.fn(async () => (reachable(), prefs)),
    savePrefs: vi.fn(async (_key: string, next: MusicListPrefs) => {
      reachable();
      prefs = next;
    }),
    playlist: vi.fn(async () => (reachable(), { entries: entries.map((e, position) => ({ entryId: e.entryId, position, track: { key: e.key } as never })) })),
    reorderPlaylist: vi.fn(async (_id: string, ids: readonly string[]) => {
      reachable();
      const byId = new Map(entries.map((e) => [e.entryId, e]));
      // Jellyfin réécrit la fin : de nouvelles entrées (les identifiants changent).
      entries = ids.map((id, i) => ({ entryId: `r${i}-${byId.get(id)!.key}`, key: byId.get(id)!.key }));
    }),
    shelves: vi.fn(async () => (reachable(), { order: { albums: [], artists: [], playlists: [] } })),
    shelfOrder: vi.fn(async () => reachable()),
  };
  return {
    api,
    setOnline: (value: boolean) => void (online = value),
    prefs: () => prefs,
    setPrefs: (next: MusicListPrefs) => void (prefs = next),
    order: () => entries.map((e) => e.key).join(""),
    setEntries: (keys: string) => void (entries = keys.split("").map((key, i) => ({ entryId: `x${i}`, key }))),
  };
}

afterEach(() => configureOrderOutbox(null));

describe("la file d'envoi des ordres", () => {
  it("sans port (webOS, tests) : l'envoi direct d'avant, rien de gardé", async () => {
    const server = fakeServer();
    await sendOrderWrite({ kind: "listPrefs", key: "liked", prefs: custom("ba"), base: ["a", "b"] }, server.api);
    expect(keysOf(server.prefs())).toBe("ba");
    expect(orderOutboxQueue()).toEqual([]);
  });

  it("en ligne : envoyée puis retirée de la file", async () => {
    const storage = memoryStorage();
    configureOrderOutbox({ storage, owner: () => "srv|u1" });
    const server = fakeServer();
    await sendOrderWrite({ kind: "listPrefs", key: "playlist:p1", prefs: custom("ba"), base: ["a", "b"] }, server.api);
    expect(keysOf(server.prefs())).toBe("ba");
    expect(storage.data.has(ORDER_OUTBOX_KEY)).toBe(false);
  });

  it("hors ligne : gardée sur le disque, survit au redémarrage, rejouée au retour en FUSIONNANT", async () => {
    const storage = memoryStorage();
    configureOrderOutbox({ storage, owner: () => "srv|u1" });
    const server = fakeServer({ prefs: custom("abcde") });
    server.setOnline(false);
    // Hors ligne : « e » glissé en tête.
    await sendOrderWrite({ kind: "listPrefs", key: "playlist:p1", prefs: custom("eabcd"), base: "abcde".split("") }, server.api);
    expect(orderOutboxQueue()).toHaveLength(1);
    expect(orderOutboxQueue()[0]!.deferred).toBe(true);
    // L'app redémarre : la file se relit du disque.
    configureOrderOutbox(null);
    configureOrderOutbox({ storage, owner: () => "srv|u1" });
    // Pendant ce temps, un autre appareil a échangé « b » et « c ».
    server.setPrefs(custom("acbde"));
    server.setOnline(true);
    const sent = vi.fn();
    await flushOrderOutbox(server.api, sent);
    expect(keysOf(server.prefs())).toBe("eacbd");
    expect(orderOutboxQueue()).toEqual([]);
    expect(sent).toHaveBeenCalledTimes(1);
  });

  it("l'ordre de la playlist Jellyfin se rejoue sur les entrées d'aujourd'hui", async () => {
    const storage = memoryStorage();
    configureOrderOutbox({ storage, owner: () => "srv|u1" });
    const server = fakeServer({ entries: "abcd" });
    server.setOnline(false);
    await sendOrderWrite({ kind: "playlistOrder", playlistId: "p1", entryIds: ["e3", "e0", "e1", "e2"], keys: "dabc".split(""), base: "abcd".split("") }, server.api);
    // Ailleurs : « x » ajouté, Jellyfin a réécrit les entrées.
    server.setEntries("abcxd");
    server.setOnline(true);
    await flushOrderOutbox(server.api);
    expect(server.order()).toBe("dabcx");
  });

  it("un refus du serveur (playlist supprimée) retire l'écriture ; une panne la garde", async () => {
    const storage = memoryStorage();
    configureOrderOutbox({ storage, owner: () => "srv|u1" });
    const server = fakeServer();
    server.api.savePrefs = vi.fn(async () => {
      throw new TentacleApiError("not_found", 404, new Headers());
    });
    await sendOrderWrite({ kind: "listPrefs", key: "playlist:p1", prefs: custom("ba"), base: null }, server.api);
    expect(orderOutboxQueue()).toEqual([]);
    server.api.savePrefs = vi.fn(async () => {
      throw new TentacleApiError("down", 503, new Headers());
    });
    await sendOrderWrite({ kind: "listPrefs", key: "playlist:p1", prefs: custom("ba"), base: null }, server.api);
    expect(orderOutboxQueue()).toHaveLength(1);
  });

  it("jamais rejouée au nom d'une autre identité", async () => {
    const storage = memoryStorage();
    let owner = "srv|u1";
    configureOrderOutbox({ storage, owner: () => owner });
    const server = fakeServer();
    server.setOnline(false);
    await sendOrderWrite({ kind: "listPrefs", key: "liked", prefs: custom("ba"), base: ["a", "b"] }, server.api);
    server.setOnline(true);
    owner = "srv|u2";
    await flushOrderOutbox(server.api);
    expect(server.api.savePrefs).toHaveBeenCalledTimes(1);
    owner = "srv|u1";
    await flushOrderOutbox(server.api);
    expect(keysOf(server.prefs())).toBe("ba");
  });
});
