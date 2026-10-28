import { describe, expect, it } from "vitest";
import type { PlaybackSource } from "@tentacle-tv/shared/music";
import { OctavePlayer, PlaybackReporter, SourceCache, type SyncStorage } from "@tentacle-tv/shared/octave";
import { createFakeEngine, libraryTrack } from "@tentacle-tv/shared/octave/testing";
import { attachPlayerResume, OCTAVE_PLAYER_KEY, readSavedPlayback } from "./playerResume";

/** La session du lecteur reprise en pause : la même règle pour le web, le bureau et le mobile. */

const sourceOf = (key: string): PlaybackSource => ({ trackKey: key, url: `/s/${key}`, origin: "library", complete: true, sizeBytes: null, durationMs: 200_000, format: null, replayGain: null, expiresAt: null });

function newPlayer() {
  const engine = createFakeEngine();
  const sources = new SourceCache({ library: async (id) => sourceOf(`jf:${id}`), external: async () => null, now: () => 0 });
  const reporter = new PlaybackReporter({ library: () => {}, externalPlayed: () => {}, now: () => 0 });
  return new OctavePlayer({ engine, sources, reporter, prefetchExternal: () => {}, skipDelayMs: 0 });
}

function memory(): SyncStorage & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

describe("reprise de la session du lecteur", () => {
  it("gardée à l'arrière-plan et au détachement, reprise en pause par la même identité", () => {
    const storage = memory();
    let hide: () => void = () => undefined;
    const deps = { storage, ownerNow: () => "srv|u1", onHide: (save: () => void) => ((hide = save), () => undefined) };
    const first = newPlayer();
    const detach = attachPlayerResume(first, "srv|u1", deps);
    first.playList(["a", "b"].map((id) => libraryTrack(id)), 1);
    hide();
    expect(readSavedPlayback(storage, "srv|u1")).not.toBeNull();
    detach();

    const second = newPlayer();
    attachPlayerResume(second, "srv|u1", deps);
    expect(second.snapshot.get().current?.key).toBe("jf:b");
    expect(second.snapshot.get().wantsPlay).toBe(false);
  });

  it("jamais au nom d'une session partie, rien sans identité", () => {
    const storage = memory();
    const player = newPlayer();
    const detach = attachPlayerResume(player, "srv|u1", { storage, ownerNow: () => "srv|u2", onHide: () => () => undefined });
    player.playList([libraryTrack("a")], 0);
    detach();
    expect(storage.data[OCTAVE_PLAYER_KEY]).toBeUndefined();
    expect(attachPlayerResume(player, null, { storage, ownerNow: () => null, onHide: () => () => undefined })).toBeTypeOf("function");
  });
});
