import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MusicTrack, PlaybackSource } from "@tentacle-tv/shared/music";
import { OctavePlayer, PlaybackReporter, SourceCache } from "@tentacle-tv/shared/octave";
import { createFakeEngine, libraryTrack } from "@tentacle-tv/shared/octave/testing";
import { recordSearchListens } from "./SearchListenRecorder";
import { forgetSearchListens, readSearchListens } from "./searchListens";

function sourceOf(key: string): PlaybackSource {
  return { trackKey: key, url: `/src/${key}`, origin: "library", complete: true, sizeBytes: null, durationMs: 200_000, format: null, replayGain: null, expiresAt: null };
}

function setup() {
  const engine = createFakeEngine();
  const sources = new SourceCache({ library: async (id: string) => sourceOf(`jf:${id}`), external: async (t: MusicTrack) => sourceOf(t.key), now: () => 0 });
  const reporter = new PlaybackReporter({ library: () => {}, externalPlayed: () => {}, now: () => 0 });
  const player = new OctavePlayer({ engine, sources, reporter, prefetchExternal: () => {}, skipDelayMs: 0 });
  return { engine, player };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const tracks = ["a", "b"].map((id) => libraryTrack(id, { album: { title: "Evolve", mbid: null, jellyfinId: null } }));

describe("l'enregistreur du « déjà écouté » (Octave)", () => {
  let store: Record<string, string>;
  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => void (store[k] = v),
      removeItem: (k: string) => void delete store[k],
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("note un titre à son PREMIER son seulement, avec sa recherche et son album", async () => {
    const { engine, player } = setup();
    const off = recordSearchListens(player, () => 42);
    player.playList(tracks, 0, "search:imagine dragons:side");
    await flush();
    expect(readSearchListens()).toEqual([]);
    engine.sound(100);
    engine.sound(400);
    expect(readSearchListens()).toHaveLength(1);
    expect(readSearchListens()[0]).toMatchObject({ query: "imagine dragons", albumTarget: null, at: 42, track: { key: "jf:a" } });
    off();
    player.dispose();
  });

  it("lancé depuis la page d'un album : l'album est retenu, sans recherche", async () => {
    const { engine, player } = setup();
    const off = recordSearchListens(player);
    player.playList(tracks, 1, "album:ext:sillon:evolve");
    await flush();
    engine.sound(100);
    expect(readSearchListens()[0]).toMatchObject({ query: null, albumTarget: "ext:sillon:evolve", track: { key: "jf:b" } });
    off();
    player.dispose();
  });

  it("oublier une recherche retire son lien, pas les titres", async () => {
    const { engine, player } = setup();
    const off = recordSearchListens(player);
    player.playList(tracks, 0, "search:Imagine Dragons");
    await flush();
    engine.sound(100);
    forgetSearchListens("imagine dragons ");
    expect(readSearchListens()[0]).toMatchObject({ query: null, track: { key: "jf:a" } });
    off();
    player.dispose();
  });
});
