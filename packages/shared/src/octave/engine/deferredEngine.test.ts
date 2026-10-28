import { describe, expect, it, vi } from "vitest";
import type { AudioEnginePort, PlaybackSource } from "../../music";
import { OctavePlayer } from "../octavePlayer";
import { PlaybackReporter } from "../playbackReports";
import { SourceCache } from "../sourceCache";
import { createFakeEngine, type FakeEngine } from "../fakeEngine";
import { libraryTrack } from "../fixtures";
import { createDeferredEngine } from "./deferredEngine";
import type { EnginePrefs } from "./bridgeAudioEngine";

/**
 * Le moteur différé : la coquille d'Octave se peint sans attendre mpv. Les
 * ordres attendent le vrai moteur, rejoués dans l'ordre (un seul titre joué),
 * l'état ne ment pas pendant l'attente, un échec ne laisse rien en file, une
 * sortie arrête le moteur qui arrive.
 */

const PREFS: EnginePrefs = { volume: 0.6, muted: false, replayGain: "auto", deviceId: null, exclusive: false };

function sourceOf(key: string): PlaybackSource {
  return { trackKey: key, url: `/src/${key}`, origin: "library", complete: true, sizeBytes: null, durationMs: 200_000, format: null, replayGain: null, expiresAt: null };
}

function controlled() {
  let resolve!: (engine: AudioEnginePort) => void;
  let reject!: (error: unknown) => void;
  const start = new Promise<AudioEnginePort>((ok, ko) => {
    resolve = ok;
    reject = ko;
  });
  return { start, resolve, reject };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const A = libraryTrack("a");
const B = libraryTrack("b");

describe("moteur différé", () => {
  it("rend un port tout de suite, avec les réglages de départ", () => {
    const port = createDeferredEngine(controlled().start, PREFS);
    expect(port.ready).toBe(false);
    expect(port.getState()).toMatchObject({ status: "idle", volume: 0.6, trackKey: null });
  });

  it("(1) rejoue dans l'ordre ; deux titres demandés avant le moteur : seul le dernier part", async () => {
    const c = controlled();
    const port = createDeferredEngine(c.start, PREFS);
    port.play(A, sourceOf(A.key));
    port.play(B, sourceOf(B.key), 1_000);
    port.seek(5_000);
    port.seek(9_000);
    port.setNext(A, sourceOf(A.key));
    port.pause();
    const real = createFakeEngine();
    c.resolve(real);
    await flush();
    expect(real.calls).toEqual([
      { method: "play", key: B.key, url: `/src/${B.key}`, startMs: 9_000 },
      { method: "setNext", key: A.key },
      { method: "pause" },
    ]);
    expect(port.ready).toBe(true);
    port.resume();
    expect(real.calls.at(-1)).toEqual({ method: "resume" });
  });

  it("(1) un arrêt efface ce qui précède ; un réglage de volume passe au vrai moteur", async () => {
    const c = controlled();
    const port = createDeferredEngine(c.start, PREFS);
    port.play(A, sourceOf(A.key));
    port.stop();
    port.setVolume(0.2);
    const real = createFakeEngine();
    c.resolve(real);
    await flush();
    expect(real.calls).toEqual([{ method: "stop" }]);
    expect(real.getState().volume).toBe(0.2);
  });

  it("la transition douce réglée avant le moteur lui est passée ; ensuite, directement", async () => {
    const c = controlled();
    const port = createDeferredEngine(c.start, PREFS);
    port.setCrossfade?.(6_000);
    const real = createFakeEngine();
    const setCrossfade = vi.fn();
    real.setCrossfade = setCrossfade;
    c.resolve(real);
    await flush();
    expect(setCrossfade).toHaveBeenCalledWith(6_000);
    port.setCrossfade?.(0);
    expect(setCrossfade).toHaveBeenLastCalledWith(0);
  });

  it("(2) Lecture avant le moteur : « loading », position immobile — jamais « playing »", () => {
    const port = createDeferredEngine(controlled().start, PREFS);
    const events: string[] = [];
    port.subscribe((e) => e.type === "state" && events.push(e.state.status));
    port.play(A, sourceOf(A.key), 30_000);
    port.pause();
    port.resume();
    expect(events).toEqual(["loading", "paused", "loading"]);
    expect(port.getState()).toMatchObject({ trackKey: A.key, positionMs: 30_000, durationMs: 200_000 });
  });

  it("(2) le lecteur d'Octave reste en « starting » (Pause affiché, barre immobile) jusqu'au son", async () => {
    const c = controlled();
    const port = createDeferredEngine(c.start, PREFS);
    const sources = new SourceCache({ library: async (id) => sourceOf(`jf:${id}`), external: async () => null, now: () => 0 });
    const reporter = new PlaybackReporter({ library: () => undefined, externalPlayed: () => undefined, now: () => 0 });
    const player = new OctavePlayer({ engine: port, sources, reporter, prefetchExternal: () => undefined, skipDelayMs: 0 });
    player.playList([A], 0);
    await flush();
    expect(player.snapshot.get()).toMatchObject({ phase: "starting", wantsPlay: true });
    expect(player.position.get().running).toBe(false);
    const real = createFakeEngine();
    c.resolve(real);
    await flush();
    expect(real.calls.filter((call) => call.method === "play")).toHaveLength(1);
    (real as FakeEngine).sound(0);
    expect(player.snapshot.get().phase).toBe("playing");
    expect(player.position.get().running).toBe(true);
    player.dispose();
  });

  it("(3) échec du démarrage : « error », plus rien en file, chaque titre demandé l'apprend", async () => {
    const c = controlled();
    const port = createDeferredEngine(c.start, PREFS);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    port.play(A, sourceOf(A.key));
    c.reject(new Error("audio_engine_start"));
    await flush();
    expect(port.getState()).toMatchObject({ status: "error", error: "audio_engine_start" });
    port.play(B, sourceOf(B.key));
    expect(port.getState()).toMatchObject({ status: "error", trackKey: B.key });
    await expect(port.listOutputs()).resolves.toEqual([]);
    warn.mockRestore();
  });

  it("(4) sortie pendant le démarrage : file vidée, le moteur qui arrive est arrêté", async () => {
    const c = controlled();
    const port = createDeferredEngine(c.start, PREFS);
    port.play(A, sourceOf(A.key));
    port.dispose();
    const real = createFakeEngine();
    const dispose = vi.spyOn(real, "dispose");
    c.resolve(real);
    await flush();
    expect(real.calls).toEqual([]);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("(4) dix allers-retours rapides : dix moteurs démarrés, dix arrêtés, aucun ordre rejoué", async () => {
    const engines: FakeEngine[] = [];
    const disposed = { count: 0 };
    for (let i = 0; i < 10; i++) {
      const c = controlled();
      const port = createDeferredEngine(c.start, PREFS);
      port.play(A, sourceOf(A.key));
      port.dispose();
      const real = createFakeEngine();
      const original = real.dispose.bind(real);
      real.dispose = () => {
        disposed.count += 1;
        original();
      };
      engines.push(real);
      c.resolve(real);
    }
    await flush();
    expect(disposed.count).toBe(10);
    expect(engines.every((e) => e.calls.length === 0)).toBe(true);
  });
});
