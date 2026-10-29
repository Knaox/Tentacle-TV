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

describe("« Arrêter » (bouton, notification, application balayée)", () => {
  it("arrête le moteur et vide la file et le contexte : plus rien en cours", async () => {
    const { engine, player } = setup();
    player.playList(["a", "b", "c"].map((id) => libraryTrack(id)), 1, "album:x");
    await flush();
    engine.sound(0);
    player.clear();
    const snap = player.snapshot.get();
    expect(engine.calls.at(-1)).toEqual({ method: "stop" });
    expect(snap.current).toBeNull();
    expect(snap.wantsPlay).toBe(false);
    expect(snap.phase).toBe("idle");
    expect(snap.queue.items).toEqual([]);
    expect(snap.queue.contextId).toBeNull();
    expect(snap.queue.cursor).toBe(-1);
    expect(player.position.get().positionMs).toBe(0);
  });

  it("garde l'aléatoire et la répétition (des réglages), pas la file", async () => {
    const { player } = setup();
    player.playList(["a", "b"].map((id) => libraryTrack(id)), 0);
    await flush();
    const q = player.snapshot.get().queue;
    player.snapshot.update({ queue: { ...q, shuffle: true, repeat: "all" } });
    player.clear();
    expect(player.snapshot.get().queue).toMatchObject({ items: [], shuffle: true, repeat: "all" });
  });

  it("la commande « stop » du système fait la même chose", async () => {
    const { engine, player } = setup();
    player.playList(["a", "b"].map((id) => libraryTrack(id)), 0);
    await flush();
    engine.emit({ type: "remote", command: "stop" });
    expect(player.snapshot.get().current).toBeNull();
    expect(player.snapshot.get().queue.items).toEqual([]);
  });

  it("après l'arrêt, un nouveau titre repart d'une file neuve", async () => {
    const { player } = setup();
    player.playList(["a", "b"].map((id) => libraryTrack(id)), 0);
    await flush();
    player.clear();
    player.playList(["z"].map((id) => libraryTrack(id)), 0);
    expect(player.snapshot.get().queue.items.map((i) => i.track.key)).toEqual(["jf:z"]);
  });
});
