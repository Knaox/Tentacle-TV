/**
 * La copie GARDÉE d'abord, toujours (Damien, 27/10 : « un titre hors bibliothèque gardé se lit en Opus ») : une
 * source en flux déjà préparée (un clic, le préchargement du suivant) ne passe plus devant la copie complète
 * arrivée depuis sur le disque.
 */

import { describe, expect, it, vi } from "vitest";
import type { PlaybackSource } from "../music";
import { createFakeEngine } from "./fakeEngine";
import { externalTrack, libraryTrack } from "./fixtures";
import { OctavePlayer } from "./octavePlayer";
import { PlaybackReporter } from "./playbackReports";
import { SourceCache } from "./sourceCache";

const stream = (key: string): PlaybackSource => ({
  trackKey: key, url: `/stream/${key}`, origin: "plugin", complete: false, sizeBytes: null, durationMs: 200_000,
  format: { codec: "opus", container: "webm", sampleRate: 48_000, bitDepth: null, bitrate: 160, channels: 2, lossless: false },
  replayGain: null, expiresAt: 6 * 3_600_000,
});
const disk = (key: string): PlaybackSource => ({
  trackKey: key, url: `/offline/${key}`, origin: "plugin", complete: true, sizeBytes: 5_000_000, durationMs: 200_000, format: null,
  replayGain: null, expiresAt: null, kept: { userId: "compte" },
});
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("SourceCache — la copie gardée passe avant le cache", () => {
  const track = externalTrack("sillon", "ytm:t:x");

  it("un titre joué en flux PUIS gardé : la copie du disque, sans redemander l'extension", async () => {
    const keptCopies = new Map<string, PlaybackSource>();
    const external = vi.fn(async () => stream(track.key));
    const sources = new SourceCache({ library: async () => stream("jf"), external, now: () => 0, kept: (key) => keptCopies.get(key) ?? null });
    expect(await sources.get(track)).toMatchObject({ url: `/stream/${track.key}` });
    // La source en flux est en cache (6 h) : avant, elle restait servie jusqu'à son expiration.
    expect(sources.peek(track.key)?.url).toBe(`/stream/${track.key}`);
    keptCopies.set(track.key, disk(track.key));
    expect(sources.peek(track.key)).toMatchObject({ url: `/offline/${track.key}`, kept: { userId: "compte" } });
    expect(await sources.get(track)).toMatchObject({ kept: { userId: "compte" } });
    expect(external).toHaveBeenCalledTimes(1);
  });

  it("la copie retirée de l'appareil : le cache d'avant, puis l'extension", async () => {
    const keptCopies = new Map([[track.key, disk(track.key)]]);
    const external = vi.fn(async () => stream(track.key));
    const sources = new SourceCache({ library: async () => stream("jf"), external, now: () => 0, kept: (key) => keptCopies.get(key) ?? null });
    expect((await sources.get(track))?.kept).toBeDefined();
    expect(external).not.toHaveBeenCalled();
    keptCopies.clear();
    expect(sources.peek(track.key)).toBeNull();
    expect((await sources.get(track))?.url).toBe(`/stream/${track.key}`);
  });

  it("sans copie gardée (le web) : exactement comme avant", async () => {
    const lib = libraryTrack("a");
    const library = vi.fn(async () => stream(lib.key));
    const sources = new SourceCache({ library, external: async () => null, now: () => 0 });
    await sources.get(lib);
    expect(sources.peek(lib.key)?.url).toBe(`/stream/${lib.key}`);
    expect(library).toHaveBeenCalledTimes(1);
  });

  it("le lecteur : rejoué après l'arrivée de la copie, le titre part du disque", async () => {
    const keptCopies = new Map<string, PlaybackSource>();
    const engine = createFakeEngine();
    const sources = new SourceCache({ library: async () => stream("jf"), external: async () => stream(track.key), now: () => 0, kept: (key) => keptCopies.get(key) ?? null });
    const reporter = new PlaybackReporter({ library: () => {}, externalPlayed: () => {}, now: () => 0 });
    const player = new OctavePlayer({ engine, sources, reporter, prefetchExternal: () => {}, skipDelayMs: 0 });
    player.playList([track], 0);
    await wait(10);
    keptCopies.set(track.key, disk(track.key));
    player.playList([track], 0);
    await wait(10);
    const plays = engine.calls.filter((c) => c.method === "play").map((c) => (c as { url: string }).url);
    expect(plays).toEqual([`/stream/${track.key}`, `/offline/${track.key}`]);
  });
});
