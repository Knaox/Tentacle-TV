import { describe, expect, it, vi } from "vitest";
import type { MusicTrack, PlaybackSource } from "../music";
import { createFakeEngine } from "./fakeEngine";
import { externalTrack, libraryTrack } from "./fixtures";
import { OctavePlayer } from "./octavePlayer";
import { queueActions } from "./octaveQueueActions";
import { applyResolution } from "./octaveResolution";
import { PlaybackReporter } from "./playbackReports";
import { SourceCache } from "./sourceCache";

function sourceOf(key: string, origin: PlaybackSource["origin"] = "library"): PlaybackSource {
  return { trackKey: key, url: `/src/${key}`, origin, complete: true, sizeBytes: null, durationMs: 200_000, format: null, replayGain: null, expiresAt: null };
}

function setup(options: { externalSource?: boolean } = {}) {
  const engine = createFakeEngine();
  const library = vi.fn(async (id: string) => sourceOf(`jf:${id}`));
  const external = vi.fn(async (track: MusicTrack) => (options.externalSource === false ? null : sourceOf(track.key, "plugin")));
  const sources = new SourceCache({ library, external, now: () => 0 });
  const reports: string[] = [];
  const reporter = new PlaybackReporter({ library: (r) => reports.push(`${r.event}:${r.itemId}`), externalPlayed: () => {}, now: () => 0 });
  const prefetched: string[] = [];
  const player = new OctavePlayer({
    engine,
    sources,
    reporter,
    prefetchExternal: (tracks, intent) => prefetched.push(...tracks.map((t) => `${intent}:${t.key}`)),
    skipDelayMs: 0,
  });
  return { engine, player, library, external, sources, reports, prefetched };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const tracks = ["a", "b", "c"].map((id) => libraryTrack(id));

describe("attente invisible", () => {
  it("le clic pose titre et « Pause » de façon SYNCHRONE, avant toute source", () => {
    const { player, engine } = setup();
    player.playList(tracks, 1, "album:1");
    const snap = player.snapshot.get();
    expect(snap.current?.key).toBe("jf:b");
    expect(snap.wantsPlay).toBe(true);
    expect(snap.phase).toBe("starting");
    expect(engine.calls).toHaveLength(0);
  });

  it("une source anticipée (appui) fait partir le moteur dans le même tour", async () => {
    const { player, engine } = setup();
    player.prefetch([tracks[0]!], "press");
    await flush();
    player.playList(tracks, 0);
    expect(engine.calls[0]).toMatchObject({ method: "play", key: "jf:a" });
  });

  it("la progression reste à zéro jusqu'au son, puis avance", async () => {
    const { player, engine } = setup();
    player.playList(tracks, 0);
    await flush();
    expect(player.position.get()).toMatchObject({ positionMs: 0, running: false });
    engine.sound(1_200);
    expect(player.position.get()).toMatchObject({ positionMs: 1_200, running: true });
    expect(player.snapshot.get().phase).toBe("playing");
  });
});

describe("le moteur ne reçoit que courant + suivant", () => {
  it("le suivant est préchargé, et l'enchaînement sans blanc avance la file", async () => {
    const { player, engine, reports } = setup();
    player.playList(tracks, 0);
    await flush();
    // Le suivant attend le son du courant (jamais deux ouvertures à la fois).
    expect(engine.calls.some((c) => c.method === "setNext")).toBe(false);
    engine.sound(0);
    await flush();
    expect(engine.calls).toContainEqual({ method: "setNext", key: "jf:b" });
    engine.emit({ type: "advanced", fromKey: "jf:a", toKey: "jf:b" });
    expect(player.snapshot.get().current?.key).toBe("jf:b");
    await flush();
    expect(engine.calls.at(-1)).toEqual({ method: "setNext", key: "jf:c" });
    expect(engine.calls.filter((c) => c.method === "play")).toHaveLength(1);
    expect(reports).toContain("start:a");
    expect(reports).toContain("stop:a");
  });

  it("l'aléatoire redit le suivant au moteur", async () => {
    const { player, engine } = setup();
    player.playList(["a", "b", "c", "d", "e"].map((id) => libraryTrack(id)), 0);
    await flush();
    engine.sound(0);
    await flush();
    const before = engine.calls.length;
    queueActions.toggleShuffle(player);
    await flush();
    expect(player.snapshot.get().queue.shuffle).toBe(true);
    expect(engine.calls.slice(before).some((c) => c.method === "setNext")).toBe(true);
  });

  it("un titre sans source est signalé puis passé", async () => {
    const { player } = setup({ externalSource: false });
    player.playList([externalTrack("sillon", "r1"), libraryTrack("b")], 0);
    await flush();
    expect(player.snapshot.get().error).toBe("noSource");
    await flush();
    await flush();
    expect(player.snapshot.get().current?.key).toBe("jf:b");
  });
});

describe("bascule à la résolution (music:resolved)", () => {
  it("le courant hors bibliothèque devient le titre de la bibliothèque, source basculée à chaud", async () => {
    const { player, engine } = setup();
    const ext = externalTrack("sillon", "r1");
    player.playList([ext, libraryTrack("b")], 0);
    await flush();
    engine.sound(30_000);
    applyResolution(player, { type: "music:resolved", pluginId: "sillon", externalId: "r1", jellyfinId: "jf9", recording: null, track: null });
    expect(player.snapshot.get().current?.key).toBe("jf:jf9");
    expect(player.snapshot.get().current?.availability).toBe("library");
    await flush();
    expect(engine.calls).toContainEqual({ method: "swapSource", key: ext.key, url: "/src/jf:jf9" });
    // Le moteur garde sa clé : ses états suivants restent reconnus.
    engine.sound(31_000);
    expect(player.position.get().positionMs).toBe(31_000);
  });

  it("une entrée plus loin dans la file est remplacée sans toucher au moteur", async () => {
    const { player, engine } = setup();
    player.playList([libraryTrack("a"), libraryTrack("b"), externalTrack("sillon", "r2")], 0);
    await flush();
    applyResolution(player, { type: "music:resolved", pluginId: "sillon", externalId: "r2", jellyfinId: "jf7", recording: null, track: null });
    expect(player.snapshot.get().queue.items[2]?.track.key).toBe("jf:jf7");
    await flush();
    expect(engine.calls.some((c) => c.method === "swapSource")).toBe(false);
  });
});
