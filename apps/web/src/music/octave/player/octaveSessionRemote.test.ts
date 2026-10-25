import { afterEach, describe, expect, it, vi } from "vitest";
import type { SessionCommand } from "@tentacle-tv/api-client";
import type { DeclaredPlaybackDto } from "@tentacle-tv/shared";
import type { PlaybackSource } from "@tentacle-tv/shared/music";
import { OctavePlayer, PlaybackReporter, SourceCache } from "@tentacle-tv/shared/octave";
import { createFakeEngine, externalTrack, libraryTrack } from "@tentacle-tv/shared/octave/testing";

/**
 * Octave dans les sessions en cours : les commandes de l'administration
 * (relayées par le canal de session) agissent sur LE lecteur d'Octave, et ce
 * qui joue est déclaré au serveur — seulement s'il sait le recevoir.
 */

const commandListeners = new Set<(c: SessionCommand) => void>();
const declarations: Array<DeclaredPlaybackDto | null> = [];

vi.mock("@tentacle-tv/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tentacle-tv/api-client")>();
  return {
    applySessionCommand: actual.applySessionCommand,
    onSessionCommand: (l: (c: SessionCommand) => void) => {
      commandListeners.add(l);
      return () => commandListeners.delete(l);
    },
    declarePlayback: (state: DeclaredPlaybackDto | null) => {
      declarations.push(state);
      return true;
    },
  };
});

const { attachSessionRemote } = await import("./octaveSessionRemote");

const sourceOf = (key: string): PlaybackSource => ({ trackKey: key, url: `/s/${key}`, origin: "plugin", complete: true, sizeBytes: null, durationMs: 200_000, format: null, replayGain: null, expiresAt: null });
const flush = () => new Promise((r) => setTimeout(r, 0));
const command = (c: SessionCommand) => commandListeners.forEach((l) => l(c));

function rig(declares = true) {
  const engine = createFakeEngine();
  const sources = new SourceCache({ library: async (id) => sourceOf(`jf:${id}`), external: async (t) => sourceOf(t.key), now: () => 0 });
  const reporter = new PlaybackReporter({ library: () => {}, externalPlayed: () => {}, now: () => 0 });
  const player = new OctavePlayer({ engine, sources, reporter, prefetchExternal: () => {} });
  const off = attachSessionRemote(player, () => declares, () => 1_000);
  return { engine, player, off };
}

afterEach(() => {
  commandListeners.clear();
  declarations.length = 0;
});

describe("la télécommande de l'administration agit sur Octave", () => {
  it("pause, reprise, arrêt", async () => {
    const { engine, player, off } = rig();
    player.playList([libraryTrack("a1"), libraryTrack("a2")], 0);
    await flush();
    engine.sound(0);
    command({ command: "Pause" });
    expect(player.snapshot.get().wantsPlay).toBe(false);
    command({ command: "Unpause" });
    expect(player.snapshot.get().wantsPlay).toBe(true);
    command({ command: "Seek", seekPositionTicks: 30 * 10_000_000 });
    expect(player.position.get().positionMs).toBe(30_000);
    command({ command: "Stop" });
    expect(player.snapshot.get().current).toBeNull();
    off();
  });

  it("rien en cours : une commande ne réveille pas une file arrêtée", () => {
    const { player, off } = rig();
    command({ command: "Unpause" });
    expect(player.snapshot.get().current).toBeNull();
    off();
  });
});

describe("ce qui joue est déclaré au serveur", () => {
  it("un titre d'extension : déclaré au premier son, effacé à l'arrêt", async () => {
    const { engine, player, off } = rig();
    player.playList([externalTrack("extension", "x1", { title: "Hors bibliothèque" })], 0);
    await flush();
    engine.sound(0);
    expect(declarations.at(-1)).toMatchObject({ title: "Hors bibliothèque", isPaused: false });
    expect(declarations.at(-1)?.itemId).toBeUndefined();
    player.stop();
    expect(declarations.at(-1)).toBeNull();
    off();
  });

  it("un serveur d'avant `sessions.musicControl` : rien n'est déclaré, la télécommande marche quand même", async () => {
    const { engine, player, off } = rig(false);
    player.playList([libraryTrack("a1")], 0);
    await flush();
    engine.sound(0);
    expect(declarations).toEqual([]);
    command({ command: "Pause" });
    expect(player.snapshot.get().wantsPlay).toBe(false);
    off();
  });
});
