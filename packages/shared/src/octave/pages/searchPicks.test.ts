import { describe, expect, it } from "vitest";
import type { MusicTrack, PlaybackSource } from "../../music";
import { OctavePlayer } from "../octavePlayer";
import { PlaybackReporter } from "../playbackReports";
import { SourceCache } from "../sourceCache";
import { createFakeEngine } from "../fakeEngine";
import { libraryTrack } from "../fixtures";
import { EMPTY_SEARCH_HISTORY } from "../../music/musicSearchHistory";
import { deviceHistorySynced, markDeviceHistorySynced, readDeviceSearchHistory, writeDeviceSearchHistory } from "./searchHistoryDevice";
import { watchSearchPicks, type SearchPick } from "./searchPicks";
import { pushRecentMusicSearchTo, readRecentMusicSearchesFrom } from "./recentMusicSearches";
import type { OctaveDeviceStore } from "./deviceStore";

function sourceOf(key: string): PlaybackSource {
  return { trackKey: key, url: `/src/${key}`, origin: "library", complete: true, sizeBytes: null, durationMs: 200_000, format: null, replayGain: null, expiresAt: null };
}

function setup() {
  const engine = createFakeEngine();
  const sources = new SourceCache({ library: async (id: string) => sourceOf(`jf:${id}`), external: async (t: MusicTrack) => sourceOf(t.key), now: () => 0 });
  const reporter = new PlaybackReporter({ library: () => {}, externalPlayed: () => {}, now: () => 0 });
  return new OctavePlayer({ engine, sources, reporter, prefetchExternal: () => {}, skipDelayMs: 0 });
}

const tracks = ["a", "b", "c"].map((id) => libraryTrack(id));

function memoryStore(): OctaveDeviceStore {
  const data: Record<string, string> = {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v), removeItem: (k) => void delete data[k] };
}

describe("titres récemment recherchés : le geste seul", () => {
  it("signale le titre choisi dans les résultats, pas l'enchaînement ni « Suivant »", () => {
    const player = setup();
    const picks: SearchPick[] = [];
    const off = watchSearchPicks(player, (p) => picks.push(p));
    player.playList(tracks, 1, "search:daft punk");
    expect(picks.map((p) => [p.track.key, p.query])).toEqual([["jf:b", "daft punk"]]);
    player.next();
    expect(picks).toHaveLength(1);
    // Un autre titre des mêmes résultats : un nouveau geste.
    player.playList(tracks, 0, "search:daft punk:tracks");
    expect(picks.map((p) => p.track.key)).toEqual(["jf:b", "jf:a"]);
    off();
    player.dispose();
  });

  it("une file qui ne vient pas d'une recherche ne signale rien", () => {
    const player = setup();
    const picks: SearchPick[] = [];
    const off = watchSearchPicks(player, (p) => picks.push(p));
    player.playList(tracks, 0, "album:x");
    player.playList(tracks, 1, null);
    expect(picks).toEqual([]);
    off();
    player.dispose();
  });
});

describe("historique de l'appareil", () => {
  it("relit les recherches d'avant (sans date) dans leur ordre, et garde les titres", () => {
    const store = memoryStore();
    pushRecentMusicSearchTo(store, "justice");
    pushRecentMusicSearchTo(store, "daft punk");
    writeDeviceSearchHistory(store, { queries: readDeviceSearchHistory(store, 1_000).queries, tracks: [{ track: tracks[0]!, at: 5 }] });
    const history = readDeviceSearchHistory(store, 1_000);
    expect(history.queries.map((q) => q.text)).toEqual(["daft punk", "justice"]);
    expect(history.tracks.map((t) => t.track.key)).toEqual(["jf:a"]);
    // La clé d'avant reste du texte : un ancien client la relit.
    expect(readRecentMusicSearchesFrom(store)).toEqual(["daft punk", "justice"]);
  });

  it("le versement au compte ne se fait qu'une fois ; un stockage vide ne casse rien", () => {
    const store = memoryStore();
    expect(deviceHistorySynced(store)).toBe(false);
    markDeviceHistorySynced(store);
    expect(deviceHistorySynced(store)).toBe(true);
    expect(readDeviceSearchHistory(null, 1)).toEqual(EMPTY_SEARCH_HISTORY);
  });
});
