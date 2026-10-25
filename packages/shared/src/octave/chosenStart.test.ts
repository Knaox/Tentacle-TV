import { afterEach, describe, expect, it, vi } from "vitest";
import type { MusicTrack, PlaybackSource } from "../music";
import { createFakeEngine } from "./fakeEngine";
import { externalTrack } from "./fixtures";
import { OctavePlayer } from "./octavePlayer";
import { queueActions } from "./octaveQueueActions";
import { PlaybackReporter } from "./playbackReports";
import { SourceCache, type SourceIntent } from "./sourceCache";
import { SLOW_START_MS } from "./sourceRetry";

const sourceOf = (key: string): PlaybackSource => ({ trackKey: key, url: `/src/${key}`, origin: "plugin", complete: true, sizeBytes: null, durationMs: 200_000, format: null, replayGain: null, expiresAt: null });
const a = externalTrack("sillon", "a");
const b = externalTrack("sillon", "b");

/** Un lecteur dont l'extension répond, demande par demande, la suite donnée (`delayMs` : son temps de réponse). */
function setup(answers: (PlaybackSource | null)[], delayMs = 0) {
  const engine = createFakeEngine();
  const asked: SourceIntent[] = [];
  const external = vi.fn(async (_track: MusicTrack, intent: SourceIntent) => {
    asked.push(intent);
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    return answers.shift() ?? null;
  });
  const sources = new SourceCache({ library: async () => sourceOf("jf"), external, now: () => 0 });
  const reporter = new PlaybackReporter({ library: () => {}, externalPlayed: () => {}, now: () => 0 });
  const player = new OctavePlayer({ engine, sources, reporter, prefetchExternal: () => {}, skipDelayMs: 0 });
  return { engine, player, asked };
}

afterEach(() => vi.useRealTimers());

describe("un titre CHOISI : tout essayer, le dire, ne jamais le sauter", () => {
  it("S7 : la source tarde → « Lecture dans un instant… » dès 800 ms, effacé au son", async () => {
    vi.useFakeTimers();
    const { player, engine } = setup([sourceOf(a.key)], 2_000);
    player.playList([a, b], 0);
    await vi.advanceTimersByTimeAsync(SLOW_START_MS - 100);
    expect(player.snapshot.get().notice).toBeNull();
    await vi.advanceTimersByTimeAsync(200);
    expect(player.snapshot.get()).toMatchObject({ notice: "retrySoon", phase: "starting", error: null });
    await vi.advanceTimersByTimeAsync(1_500);
    expect(engine.calls.find((c) => c.method === "play")).toMatchObject({ key: a.key });
    expect(player.snapshot.get().notice).toBeNull();
  });

  it("une source qui vient vite : aucun avis", async () => {
    vi.useFakeTimers();
    const { player } = setup([sourceOf(a.key)], 100);
    player.playList([a], 0);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(player.snapshot.get().notice).toBeNull();
  });

  it("« Réessayer » redemande le titre de zéro (intention `retry`), et il joue", async () => {
    const { player, engine, asked } = setup([null, sourceOf(a.key)]);
    player.playList([a, b], 0);
    await new Promise((r) => setTimeout(r, 10));
    expect(player.snapshot.get()).toMatchObject({ phase: "error", error: "noSource" });
    expect(player.snapshot.get().current?.key).toBe(a.key);
    queueActions.retry(player);
    expect(player.snapshot.get()).toMatchObject({ phase: "starting", error: null });
    await new Promise((r) => setTimeout(r, 10));
    expect(asked).toEqual(["play", "retry"]);
    expect(engine.calls.find((c) => c.method === "play")).toMatchObject({ key: a.key });
  });

  it("Lecture sur un titre en échec : c'est « Réessayer »", async () => {
    const { player, asked } = setup([null, null]);
    player.playList([a], 0);
    await new Promise((r) => setTimeout(r, 10));
    player.togglePlay();
    await new Promise((r) => setTimeout(r, 10));
    expect(asked).toEqual(["play", "retry"]);
    expect(player.snapshot.get().current?.key).toBe(a.key);
  });
});
