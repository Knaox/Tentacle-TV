import { describe, expect, it } from "vitest";
import type { PlaybackSource } from "../music";
import { createFakeEngine } from "./fakeEngine";
import { libraryTrack } from "./fixtures";
import { OctavePlayer } from "./octavePlayer";
import { PlaybackReporter } from "./playbackReports";
import { SourceCache } from "./sourceCache";

function sourceOf(key: string): PlaybackSource {
  return { trackKey: key, url: `/src/${key}`, origin: "library", complete: true, sizeBytes: null, durationMs: 200_000, format: null, replayGain: null, expiresAt: null };
}

function setup() {
  const engine = createFakeEngine();
  const sources = new SourceCache({ library: async (id: string) => sourceOf(`jf:${id}`), external: async () => null, now: () => 0 });
  const reporter = new PlaybackReporter({ library: () => {}, externalPlayed: () => {}, now: () => 0 });
  const player = new OctavePlayer({ engine, sources, reporter, prefetchExternal: () => {}, skipDelayMs: 0 });
  return { engine, player };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const tracks = ["a", "b"].map((id) => libraryTrack(id));

describe("« Lecture » après une absence de l'app", () => {
  it("le moteur a gardé le titre : une simple reprise", async () => {
    const { player, engine } = setup();
    player.playList(tracks, 0);
    await flush();
    engine.sound(40_000);
    player.pause();
    engine.calls.length = 0;
    player.togglePlay();
    expect(engine.calls).toEqual([{ method: "resume" }]);
  });

  it("le moteur a PERDU le titre (libéré derrière) : il le reçoit de nouveau, à sa position", async () => {
    const { player, engine } = setup();
    player.playList(tracks, 0);
    await flush();
    engine.sound(40_000);
    player.pause();
    // Le natif s'est vidé sans geste du lecteur : état « idle », plus de titre.
    engine.stop();
    expect(player.snapshot.get()).toMatchObject({ phase: "paused", wantsPlay: false });
    engine.calls.length = 0;
    player.togglePlay();
    await flush();
    expect(engine.calls[0]).toMatchObject({ method: "play", key: "jf:a", startMs: 40_000 });
    expect(player.snapshot.get().wantsPlay).toBe(true);
  });

  it("pendant un départ (source pas encore au moteur), rien n'est rejoué", () => {
    const { player, engine } = setup();
    player.playList(tracks, 0);
    player.pause();
    player.togglePlay();
    expect(engine.calls.filter((c) => c.method === "play")).toHaveLength(0);
    expect(player.snapshot.get()).toMatchObject({ phase: "starting", wantsPlay: true });
  });
});
