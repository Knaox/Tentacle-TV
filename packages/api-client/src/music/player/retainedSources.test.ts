import { afterEach, describe, expect, it, vi } from "vitest";
import type { MusicTrack, PlaybackSource } from "@tentacle-tv/shared/music";
import type { SourceResolvers } from "@tentacle-tv/shared/octave";
import { forgetRetainedSourcesForTests, retainedSourceCache } from "./retainedSources";

const track = { key: "ext:p:a", jellyfinId: null, external: { pluginId: "p", id: "a" }, availability: "remote" } as unknown as MusicTrack;
const source = (url: string): PlaybackSource =>
  ({ trackKey: track.key, url, origin: "plugin", complete: true, sizeBytes: null, durationMs: null, format: null, replayGain: null, expiresAt: null }) as PlaybackSource;

function resolvers(url: string): SourceResolvers & { external: ReturnType<typeof vi.fn> } {
  return { library: vi.fn(), external: vi.fn(async () => source(url)), now: () => 0 } as never;
}

afterEach(() => forgetRetainedSourcesForTests());

describe("retainedSourceCache", () => {
  it("un lecteur remonté pour le même compte retrouve la source déjà résolue, sans nouvelle requête", async () => {
    const first = resolvers("/a");
    await retainedSourceCache("srv|u1", first).get(track);
    const second = resolvers("/b");
    const cache = retainedSourceCache("srv|u1", second);
    expect(cache.peek(track.key)?.url).toBe("/a");
    expect(second.external).not.toHaveBeenCalled();
  });

  it("les demandes suivantes passent par les résolveurs de la DERNIÈRE session", async () => {
    retainedSourceCache("srv|u1", resolvers("/a"));
    const second = resolvers("/b");
    const cache = retainedSourceCache("srv|u1", second);
    expect((await cache.get(track))?.url).toBe("/b");
    expect(second.external).toHaveBeenCalledTimes(1);
  });

  it("un autre compte repart d'un cache vide", async () => {
    await retainedSourceCache("srv|u1", resolvers("/a")).get(track);
    expect(retainedSourceCache("srv|u2", resolvers("/b")).peek(track.key)).toBeNull();
  });

  it("sans propriétaire, rien n'est gardé", async () => {
    await retainedSourceCache(null, resolvers("/a")).get(track);
    expect(retainedSourceCache(null, resolvers("/b")).peek(track.key)).toBeNull();
  });
});
