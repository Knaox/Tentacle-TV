import { describe, expect, it, vi } from "vitest";
import type { MusicTrack, PlaybackSource } from "../music";
import { createFakeEngine } from "./fakeEngine";
import { externalTrack } from "./fixtures";
import { OctavePlayer } from "./octavePlayer";
import { PlaybackReporter } from "./playbackReports";
import { SourceCache, type ExternalRetry } from "./sourceCache";
import { RETRY_MAX_WAIT_MS, scheduleSourceRetry } from "./sourceRetry";

const sourceOf = (key: string): PlaybackSource => ({ trackKey: key, url: `/src/${key}`, origin: "plugin", complete: true, sizeBytes: null, durationMs: 200_000, format: null, replayGain: null, expiresAt: null });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Un lecteur dont l'extension répond, titre par titre, la suite de réponses donnée. */
function setup(answers: Record<string, (PlaybackSource | ExternalRetry | null)[]>) {
  const engine = createFakeEngine();
  const external = vi.fn(async (track: MusicTrack) => {
    const next = answers[track.key]?.shift();
    return next === undefined ? null : next;
  });
  const sources = new SourceCache({ library: async (id) => sourceOf(`jf:${id}`), external, now: () => 0 });
  const reporter = new PlaybackReporter({ library: () => {}, externalPlayed: () => {}, now: () => 0 });
  const player = new OctavePlayer({ engine, sources, reporter, prefetchExternal: () => {}, skipDelayMs: 0 });
  return { engine, external, player };
}

const a = externalTrack("sillon", "a");
const b = externalTrack("sillon", "b");

describe("« réessaie plus tard » (contrat `retry` de music.resolve)", () => {
  it("le titre RESTE, « Lecture dans un instant… », puis il joue au second essai — sans passer au suivant", async () => {
    const { player, engine, external } = setup({ [a.key]: [{ retryAfterMs: 30 }, sourceOf(a.key)] });
    player.playList([a, b], 0);
    await wait(5);
    expect(player.snapshot.get()).toMatchObject({ notice: "retrySoon", error: null, phase: "starting" });
    expect(player.snapshot.get().current?.key).toBe(a.key);
    await wait(60);
    expect(external).toHaveBeenCalledTimes(2);
    expect(engine.calls.find((c) => c.method === "play")).toMatchObject({ key: a.key });
    expect(player.snapshot.get().notice).toBeNull();
  });

  it("un titre CHOISI : jusqu'à trois nouveaux essais, puis l'échec — et il RESTE, jamais sauté", async () => {
    const { player, external } = setup({ [a.key]: [{ retryAfterMs: 10 }, { retryAfterMs: 10 }, { retryAfterMs: 10 }, { retryAfterMs: 10 }], [b.key]: [sourceOf(b.key)] });
    player.playList([a, b], 0);
    await wait(150);
    expect(external.mock.calls.filter(([t]) => t.key === a.key)).toHaveLength(4);
    expect(player.snapshot.get().current?.key).toBe(a.key);
    expect(player.snapshot.get()).toMatchObject({ phase: "error", error: "noSource", notice: null });
  });

  it("un titre ENCHAÎNÉ : un seul nouvel essai, puis l'échec ordinaire (et le suivant)", async () => {
    const first = externalTrack("sillon", "first");
    const { player, engine, external } = setup({ [first.key]: [sourceOf(first.key)], [a.key]: [{ retryAfterMs: 10 }, { retryAfterMs: 10 }], [b.key]: [sourceOf(b.key)] });
    player.playList([first, a, b], 0);
    await wait(5);
    engine.sound(0);
    engine.emit({ type: "state", state: { ...engine.getState(), status: "ended" } });
    await wait(150);
    // Le préchargement du suivant (a) a eu son « réessaie » ; à l'enchaînement, un seul nouvel essai, puis b.
    expect(player.snapshot.get().current?.key).toBe(b.key);
    expect(player.snapshot.get().notice).toBeNull();
    expect(external.mock.calls.filter(([t]) => t.key === a.key).length).toBeLessThanOrEqual(3);
  });

  it("l'utilisateur change de titre pendant l'attente : le nouvel essai n'a pas lieu", async () => {
    const { player, external } = setup({ [a.key]: [{ retryAfterMs: 30 }, sourceOf(a.key)], [b.key]: [sourceOf(b.key)] });
    player.playList([a, b], 0);
    await wait(5);
    player.next();
    await wait(60);
    expect(external.mock.calls.filter(([t]) => t.key === a.key)).toHaveLength(1);
    expect(player.snapshot.get().current?.key).toBe(b.key);
    expect(player.snapshot.get().notice).toBeNull();
  });

  it("le délai demandé est borné à 10 s, et sans « réessaie » rien n'est programmé", () => {
    const timers: number[] = [];
    const sources = { takeRetryHint: vi.fn().mockReturnValueOnce(600_000).mockReturnValue(null), get: vi.fn() } as unknown as SourceCache;
    const hooks = { current: () => true, notice: vi.fn(), done: vi.fn(), setTimeout: (_fn: () => void, ms: number) => timers.push(ms) };
    expect(scheduleSourceRetry(sources, a, hooks)).toBe(true);
    expect(timers).toEqual([RETRY_MAX_WAIT_MS]);
    expect(hooks.notice).toHaveBeenCalledWith("retrySoon");
    expect(scheduleSourceRetry(sources, a, hooks)).toBe(false);
  });
});
