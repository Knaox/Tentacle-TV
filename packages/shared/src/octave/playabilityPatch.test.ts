import { afterEach, describe, expect, it, vi } from "vitest";
import type { MusicTrack, PlaybackSource } from "../music";
import { createFakeEngine } from "./fakeEngine";
import { externalTrack, libraryTrack } from "./fixtures";
import { OctavePlayer } from "./octavePlayer";
import { PlaybackReporter } from "./playbackReports";
import { onPlayabilityLearned, refusedQueue } from "./playabilityPatch";
import { createQueue, currentItem } from "./queueModel";
import { SourceCache } from "./sourceCache";
import { isTrackUnavailable, onUnavailableTrack } from "./unavailableTrack";

/** Lot « ol » : un titre que la SOURCE refuse au moment de lire — grisé sur place, la file passe, rien ne bloque. */
const sourceOf = (key: string): PlaybackSource => ({ trackKey: key, url: `/s/${key}`, origin: "plugin", complete: true, sizeBytes: null, durationMs: 1_000, format: null, replayGain: null, expiresAt: null });
const flush = () => new Promise((r) => setTimeout(r, 0));

function playerRefusing(refused: ReadonlySet<string>) {
  const engine = createFakeEngine();
  const sources = new SourceCache({
    library: async (id) => sourceOf(`jf:${id}`),
    external: async (t: MusicTrack) => (refused.has(t.key) ? { refused: "region" as const } : sourceOf(t.key)),
    now: () => 0,
  });
  const player = new OctavePlayer({
    engine,
    sources,
    reporter: new PlaybackReporter({ library: () => {}, externalPlayed: () => {}, now: () => 0 }),
    prefetchExternal: () => {},
    skipDelayMs: 0,
  });
  return { player, engine };
}

const offs: (() => void)[] = [];
afterEach(() => offs.splice(0).forEach((off) => off()));

describe("refus de la source — le lecteur", () => {
  const x = externalTrack("sillon", "ytm:x");
  const y = externalTrack("sillon", "ytm:y");
  const z = externalTrack("sillon", "ytm:z");

  it("un titre CHOISI refusé : grisé dans la file, dit, et la file part du lisible suivant", async () => {
    const told = vi.fn();
    const learned = vi.fn();
    offs.push(onUnavailableTrack(told), onPlayabilityLearned(learned));
    const { player, engine } = playerRefusing(new Set([x.key]));
    player.playList([x, libraryTrack("a")], 0, "search:q");
    await flush();
    const snap = player.snapshot.get();
    expect(isTrackUnavailable(snap.queue.items[0]!.track)).toBe(true);
    expect(snap.queue.items[0]!.track.playableReason).toBe("region");
    expect(told).toHaveBeenCalledTimes(1);
    expect(learned.mock.calls[0]![0].get(x.key)).toEqual({ playable: "no", reason: "region" });
    expect(snap.current?.key).toBe("jf:a");
    expect(engine.calls.some((c) => c.method === "play" && c.key === "jf:a")).toBe(true);
    player.dispose();
  });

  it("trois refus d'affilée en enchaînement : sautés sans avis, jamais un lecteur arrêté sur le deuxième", async () => {
    const told = vi.fn();
    offs.push(onUnavailableTrack(told));
    const { player } = playerRefusing(new Set([x.key, y.key, z.key]));
    player.playList([libraryTrack("a"), x, y, z, libraryTrack("b")], 0, "album:1");
    await flush();
    player.next();
    await flush();
    await flush();
    expect(player.snapshot.get().current?.key).toBe("jf:b");
    expect(player.snapshot.get().queue.items.filter((i) => isTrackUnavailable(i.track))).toHaveLength(3);
    // « Suivant » est un geste : le premier refus se dit, les suivants (enchaînés) non.
    expect(told).toHaveBeenCalledTimes(1);
    player.dispose();
  });

  it("un serveur d'avant (aucun `refused`) : l'échec ordinaire, comme avant", async () => {
    const engine = createFakeEngine();
    const sources = new SourceCache({ library: async (id) => sourceOf(`jf:${id}`), external: async () => null, now: () => 0 });
    const player = new OctavePlayer({ engine, sources, reporter: new PlaybackReporter({ library: () => {}, externalPlayed: () => {}, now: () => 0 }), prefetchExternal: () => {}, skipDelayMs: 0 });
    player.playList([x, libraryTrack("a")], 0, "search:q");
    await flush();
    expect(player.snapshot.get().error).toBe("noSource");
    expect(isTrackUnavailable(player.snapshot.get().queue.items[0]!.track)).toBe(false);
    player.dispose();
  });
});

describe("refusedQueue", () => {
  it("marque chaque entrée du titre ; la même file quand c'est déjà fait", () => {
    const x = externalTrack("sillon", "ytm:x");
    const q = createQueue([libraryTrack("a"), x, x], 0);
    const once = refusedQueue(q, x.key, "age");
    expect(once.items.filter((i) => isTrackUnavailable(i.track))).toHaveLength(2);
    expect(refusedQueue(once, x.key, "age")).toBe(once);
    expect(currentItem(once)?.track.key).toBe("jf:a");
  });
});
