import { describe, expect, it } from "vitest";
import type { PlaybackSource } from "../music";
import { createFakeEngine } from "./fakeEngine";
import { libraryTrack } from "./fixtures";
import { OctavePlayer } from "./octavePlayer";
import { PlaybackReporter } from "./playbackReports";
import { SourceCache } from "./sourceCache";

const sourceOf = (key: string): PlaybackSource => ({ trackKey: key, url: `/src/${key}`, origin: "library", complete: true, sizeBytes: null, durationMs: 200_000, format: null, replayGain: null, expiresAt: null });
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
  const engine = createFakeEngine();
  const sources = new SourceCache({ library: async (id) => sourceOf(`jf:${id}`), external: async () => null, now: () => 0 });
  const reporter = new PlaybackReporter({ library: () => {}, externalPlayed: () => {}, now: () => 0 });
  const player = new OctavePlayer({ engine, sources, reporter, prefetchExternal: () => {}, skipDelayMs: 0 });
  return { engine, player };
}

describe("contrôles du système (écran verrouillé, notification, casque)", () => {
  it("une pause du système remet le bouton sur « Lecture », sa reprise le relance", async () => {
    const { engine, player } = setup();
    player.playList(["a", "b"].map((id) => libraryTrack(id)), 0);
    await flush();
    engine.sound(0);
    engine.emit({ type: "remote", command: "pause" });
    expect(player.snapshot.get().wantsPlay).toBe(false);
    expect(engine.calls.at(-1)).toEqual({ method: "pause" });
    engine.emit({ type: "remote", command: "play" });
    expect(player.snapshot.get().wantsPlay).toBe(true);
    expect(engine.calls.at(-1)).toEqual({ method: "resume" });
  });

  it("suivant et précédent passent par la file du lecteur", async () => {
    const { engine, player } = setup();
    player.playList(["a", "b", "c"].map((id) => libraryTrack(id)), 0);
    await flush();
    engine.emit({ type: "remote", command: "next" });
    expect(player.snapshot.get().current?.key).toBe("jf:b");
    engine.emit({ type: "remote", command: "previous" });
    expect(player.snapshot.get().current?.key).toBe("jf:a");
  });
});
