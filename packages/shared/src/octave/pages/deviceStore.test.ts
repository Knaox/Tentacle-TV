import { describe, expect, it } from "vitest";
import { libraryTrack } from "../testing";
import type { OctaveDeviceStore } from "./deviceStore";
import { pushRecentMusicSearchTo, readRecentMusicSearchesFrom, removeRecentMusicSearchFrom } from "./recentMusicSearches";
import { forgetRecentVisitsIn, readRecentVisitsFrom, recordVisitTo } from "./recentVisits";
import { forgetSearchListensIn, readSearchListensFrom, recordSearchListenTo } from "./searchListens";

function memoryStore(): OctaveDeviceStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
}

describe("mémoire de l'appareil (stockage passé en paramètre)", () => {
  it("garde les recherches récentes, la plus récente en tête, sans doublon de casse", () => {
    const store = memoryStore();
    pushRecentMusicSearchTo(store, "Daft Punk");
    pushRecentMusicSearchTo(store, "justice");
    expect(pushRecentMusicSearchTo(store, "daft  punk")).toEqual(["daft punk", "justice"]);
    expect(removeRecentMusicSearchFrom(store, "JUSTICE")).toEqual(["daft punk"]);
    expect(readRecentMusicSearchesFrom(store)).toEqual(["daft punk"]);
  });

  it("note une écoute avec la recherche qui l'a lancée, puis l'oublie avec elle", () => {
    const store = memoryStore();
    const track = libraryTrack("a");
    recordSearchListenTo(store, track, "search:daft punk", 1);
    expect(readSearchListensFrom(store)[0]).toMatchObject({ query: "daft punk" });
    forgetSearchListensIn(store, "Daft Punk");
    expect(readSearchListensFrom(store)[0]?.query).toBeNull();
  });

  it("sépare les pages consultées par identité, et un stockage illisible ne casse rien", () => {
    const store = memoryStore();
    const album = { key: "jf:1", jellyfinId: "1", title: "Discovery" } as never;
    recordVisitTo(store, { kind: "album", item: album, at: 1 }, "srv|u1");
    expect(readRecentVisitsFrom(store, "srv|u1")).toHaveLength(1);
    expect(readRecentVisitsFrom(store, "srv|u2")).toEqual([]);
    forgetRecentVisitsIn(store);
    expect(readRecentVisitsFrom(store, "srv|u1")).toEqual([]);
    store.map.set("tentacle_octave_recent_searches", "{pas du json");
    expect(readRecentMusicSearchesFrom(store)).toEqual([]);
    expect(readRecentMusicSearchesFrom(null)).toEqual([]);
  });
});
