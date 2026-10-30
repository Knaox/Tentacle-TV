import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { MusicSearchHistory, MusicTrack } from "@tentacle-tv/shared/music";
import { deviceHistorySynced, pushRecentMusicSearchTo, readDeviceSearchHistory, readRecentMusicSearchesFrom, type OctaveDeviceStore } from "@tentacle-tv/shared/octave";

const server = vi.hoisted(() => ({ history: { queries: [], tracks: [] } as MusicSearchHistory, calls: [] as [string, unknown][], fail: false }));

vi.mock("../../../hooks/usePreferences", async () => {
  const { mergeSearchHistory, forgetInSearchHistory } = await import("@tentacle-tv/shared/music");
  return {
    tentacleApiFetch: async (path: string, init?: { method?: string; body?: string }) => {
      const body = init?.body ? JSON.parse(init.body) : undefined;
      server.calls.push([`${init?.method ?? "GET"} ${path}`, body]);
      if (server.fail) throw new Error("hors ligne");
      if (path.endsWith("/forget")) server.history = forgetInSearchHistory(server.history, body);
      else if (init?.method === "POST") server.history = mergeSearchHistory(server.history, body);
      return server.history;
    },
  };
});

import { searchHistoryActions } from "./searchHistoryActions";
import { readAccountHistory } from "./useOctaveSearchHistory";

function memoryStore(): OctaveDeviceStore {
  const data: Record<string, string> = {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v), removeItem: (k) => void delete data[k] };
}

const track = (key: string) => ({ key, title: key, artists: [], artworkUrl: null }) as unknown as MusicTrack;
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  server.history = { queries: [], tracks: [] };
  server.calls = [];
  server.fail = false;
});

describe("historique de la recherche — compte et appareil", () => {
  it("la première lecture du compte lui verse l'historique de l'appareil, une seule fois", async () => {
    const store = memoryStore();
    pushRecentMusicSearchTo(store, "daft punk");
    server.history = { queries: [{ text: "justice", at: 5 }], tracks: [] };
    const first = await readAccountHistory(store, undefined, () => 1_000);
    expect(first.queries.map((q) => q.text)).toEqual(["daft punk", "justice"]);
    expect(deviceHistorySynced(store)).toBe(true);
    await readAccountHistory(store, undefined, () => 2_000);
    expect(server.calls.map((c) => c[0])).toEqual(["POST /api/music/search-history", "GET /api/music/search-history"]);
    // Le miroir de l'appareil suit le compte.
    expect(readRecentMusicSearchesFrom(store)).toEqual(["daft punk", "justice"]);
  });

  it("un versement refusé (hors ligne) sera retenté : rien n'est marqué", async () => {
    const store = memoryStore();
    pushRecentMusicSearchTo(store, "air");
    server.fail = true;
    await expect(readAccountHistory(store)).rejects.toThrow();
    expect(deviceHistorySynced(store)).toBe(false);
  });

  it("au compte : chaque geste se voit tout de suite, part au serveur, et sa réponse fait foi", async () => {
    const qc = new QueryClient();
    const store = memoryStore();
    const actions = searchHistoryActions(qc, "account", store, () => 10);
    actions.rememberQuery("  Daft   Punk ");
    actions.rememberTrack(track("jf:a"));
    const shown = qc.getQueryData<MusicSearchHistory>(["music", "search-history", "account"]);
    expect(shown?.queries.map((q) => q.text)).toEqual(["Daft Punk"]);
    expect(shown?.tracks.map((t) => t.track.key)).toEqual(["jf:a"]);
    await flush();
    expect(server.history.tracks.map((t) => t.track.key)).toEqual(["jf:a"]);
    actions.forgetTrack("jf:a");
    actions.clearAll();
    await flush();
    expect(server.history).toEqual({ queries: [], tracks: [] });
    expect(readDeviceSearchHistory(store, 0)).toEqual({ queries: [], tracks: [] });
  });

  it("sans la capacité : l'appareil seul, rien ne part", async () => {
    const qc = new QueryClient();
    const store = memoryStore();
    const actions = searchHistoryActions(qc, "device", store);
    actions.rememberQuery("justice");
    actions.rememberTrack(track("jf:b"));
    await flush();
    expect(server.calls).toEqual([]);
    expect(readDeviceSearchHistory(store, 0).tracks.map((t) => t.track.key)).toEqual(["jf:b"]);
    expect(readRecentMusicSearchesFrom(store)).toEqual(["justice"]);
  });
});
