import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionCommand } from "@tentacle-tv/api-client";
import type { DeclaredPlaybackDto } from "@tentacle-tv/shared";
import type { MusicPlaybackReport, PlaybackSource } from "@tentacle-tv/shared/music";
import { OctavePlayer, PlaybackReporter, SourceCache, restorePlayback, savePlayback } from "@tentacle-tv/shared/octave";
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
  const reports: MusicPlaybackReport[] = [];
  const reporter = new PlaybackReporter({ library: (r) => reports.push(r), externalPlayed: () => {}, now: () => 0 });
  const player = new OctavePlayer({ engine, sources, reporter, prefetchExternal: () => {} });
  const gate = { declares };
  const remote = attachSessionRemote(player, () => gate.declares, () => 1_000);
  return { engine, player, reports, gate, remote, off: remote.detach };
}

// Un `window` réduit à ce qu'emploie le module : les évènements de page.
beforeEach(() => {
  vi.stubGlobal("window", new EventTarget());
});

afterEach(() => {
  vi.unstubAllGlobals();
  commandListeners.clear();
  declarations.length = 0;
});

/** `pagehide` / `pageshow` : Node n'a pas `PageTransitionEvent`. */
const pageEvent = (type: "pagehide" | "pageshow", persisted: boolean) => Object.assign(new Event(type), { persisted });

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

describe("la page qui part, et celle qui revient", () => {
  it("au départ de la page, l'arrêt part chez Jellyfin et la déclaration est retirée — le lecteur n'est pas touché", async () => {
    const { engine, player, reports, off } = rig();
    player.playList([libraryTrack("a1")], 0);
    await flush();
    engine.sound(0);
    window.dispatchEvent(pageEvent("pagehide", false));
    expect(reports.map((r) => r.event)).toEqual(["start", "stop"]);
    expect(declarations.at(-1)).toBeNull();
    // La reprise de la page suivante (D6) garde le titre : rien n'est arrêté ici.
    expect(player.snapshot.get().current?.key).toBe(libraryTrack("a1").key);
    off();
  });

  it("une page restaurée du cache de navigation se redéclare", async () => {
    const { engine, player, off } = rig();
    player.playList([libraryTrack("a1")], 0);
    await flush();
    engine.sound(0);
    window.dispatchEvent(pageEvent("pagehide", true));
    window.dispatchEvent(pageEvent("pageshow", true));
    expect(declarations.at(-1)).toMatchObject({ itemId: "a1", isPaused: false });
    off();
  });

  it("la reprise EN PAUSE (D6) ne se déclare jamais « en lecture », et ne rapporte rien à Jellyfin", async () => {
    const before = rig(false);
    before.player.playList([libraryTrack("a1"), libraryTrack("a2")], 0);
    await flush();
    before.engine.sound(0);
    const saved = savePlayback(before.player.snapshot.get(), 4_650);
    before.off();
    const { player, reports, off } = rig();
    expect(restorePlayback(player, saved)).toBe(true);
    expect(declarations.at(-1)).toMatchObject({ itemId: "a1", isPaused: true, positionMs: 4_650 });
    expect(declarations.every((d) => d === null || d.isPaused)).toBe(true);
    expect(reports).toEqual([]);
    off();
  });

  it("la capacité connue après coup : la déclaration part dès la resynchronisation", async () => {
    const { engine, player, gate, remote, off } = rig(false);
    player.playList([libraryTrack("a1")], 0);
    await flush();
    engine.sound(0);
    expect(declarations).toEqual([]);
    gate.declares = true;
    remote.resync();
    expect(declarations.at(-1)).toMatchObject({ itemId: "a1" });
    off();
  });
});
