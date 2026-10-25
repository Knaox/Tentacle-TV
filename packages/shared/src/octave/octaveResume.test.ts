import { describe, expect, it, vi } from "vitest";
import type { MusicTrack, PlaybackSource } from "../music";
import { createFakeEngine } from "./fakeEngine";
import { libraryTrack } from "./fixtures";
import { OctavePlayer } from "./octavePlayer";
import { queueActions } from "./octaveQueueActions";
import { restorePlayback, revivePlayback, savePlayback, type SavedPlayback } from "./octaveResume";
import { PlaybackReporter } from "./playbackReports";
import { SourceCache } from "./sourceCache";

/**
 * Octave — la session quittée revient au lancement : le titre dans la barre,
 * en pause, à sa position, rien de chargé ; « Lecture » repart de là.
 */

function sourceOf(key: string): PlaybackSource {
  return { trackKey: key, url: `/src/${key}`, origin: "library", complete: true, sizeBytes: null, durationMs: 200_000, format: null, replayGain: null, expiresAt: null };
}

function setup() {
  const engine = createFakeEngine();
  const library = vi.fn(async (id: string) => sourceOf(`jf:${id}`));
  const sources = new SourceCache({ library, external: async (_t: MusicTrack) => null, now: () => 0 });
  const reports: string[] = [];
  const reporter = new PlaybackReporter({ library: (r) => reports.push(`${r.event}:${r.itemId}`), externalPlayed: () => {}, now: () => 0 });
  const player = new OctavePlayer({ engine, sources, reporter, prefetchExternal: () => {}, skipDelayMs: 0 });
  return { engine, player, library, reports };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const tracks = ["a", "b", "c", "d"].map((id) => ({ ...libraryTrack(id), durationMs: 180_000 }));

function savedAt(cursor: number, positionMs: number, over: Partial<SavedPlayback> = {}): SavedPlayback {
  return { v: 1, tracks, cursor, original: [0, 1, 2, 3], shuffle: false, repeat: "off", contextId: "album:1", positionMs, ...over };
}

describe("ce que l'appareil garde du lecteur", () => {
  it("rien sans titre en cours", () => {
    const { player } = setup();
    expect(savePlayback(player.snapshot.get(), 0)).toBeNull();
  });

  it("la file, le titre en cours, sa position, l'aléatoire et le contexte", async () => {
    const { player } = setup();
    player.playList(tracks, 2, "album:1");
    await flush();
    const saved = savePlayback(player.snapshot.get(), 61_234.6);
    expect(saved).toMatchObject({ v: 1, cursor: 2, original: [0, 1, 2, 3], shuffle: false, repeat: "off", contextId: "album:1", positionMs: 61_235 });
    expect(saved?.tracks.map((t) => t.key)).toEqual(["jf:a", "jf:b", "jf:c", "jf:d"]);
  });

  it("une longue file est bornée AUTOUR du titre en cours", async () => {
    const { player } = setup();
    const many = Array.from({ length: 500 }, (_, i) => libraryTrack(`t${i}`));
    player.playList(many, 300);
    const saved = savePlayback(player.snapshot.get(), 0, 50)!;
    expect(saved.tracks).toHaveLength(50);
    expect(saved.tracks[saved.cursor]?.key).toBe("jf:t300");
    expect(saved.cursor).toBe(20);
  });
});

describe("la reprise au lancement", () => {
  it("titre et file affichés EN PAUSE, à leur position, sans rien charger ni jouer", () => {
    const { player, engine, library } = setup();
    expect(restorePlayback(player, savedAt(1, 42_000))).toBe(true);
    const snap = player.snapshot.get();
    expect(snap.current?.key).toBe("jf:b");
    expect(snap).toMatchObject({ wantsPlay: false, phase: "paused" });
    expect(snap.queue.items).toHaveLength(4);
    expect(player.position.get()).toEqual({ positionMs: 42_000, durationMs: 180_000, running: false });
    expect(engine.calls).toHaveLength(0);
    expect(library).not.toHaveBeenCalled();
  });

  it("« Lecture » démarre le titre À SA POSITION ; un déplacement d'abord la change", async () => {
    const { player, engine } = setup();
    restorePlayback(player, savedAt(1, 42_000));
    player.seek(50_000);
    expect(engine.calls).toHaveLength(0);
    player.togglePlay();
    await flush();
    expect(engine.calls[0]).toMatchObject({ method: "play", key: "jf:b", startMs: 50_000 });
    expect(player.restoredAtMs).toBeNull();
  });

  it("« Suivant » part du titre suivant, au début", async () => {
    const { player, engine } = setup();
    restorePlayback(player, savedAt(1, 42_000));
    player.next();
    await flush();
    expect(engine.calls[0]).toMatchObject({ method: "play", key: "jf:c", startMs: 0 });
  });

  it("un geste de file ne prépare aucun suivant tant que rien ne joue", () => {
    const { player, engine } = setup();
    restorePlayback(player, savedAt(0, 0));
    queueActions.enqueue(player, [libraryTrack("z")]);
    expect(engine.calls).toHaveLength(0);
    expect(player.snapshot.get().queue.items).toHaveLength(5);
  });

  it("aucun rapport d'écoute pour une reprise jamais jouée", () => {
    const { player, reports } = setup();
    restorePlayback(player, savedAt(1, 42_000));
    player.stop();
    expect(reports).toEqual([]);
  });

  it("une position au-delà de la fin repart du début du titre", () => {
    const { player } = setup();
    restorePlayback(player, savedAt(0, 999_999));
    expect(player.position.get().positionMs).toBe(0);
  });

  it("jamais par-dessus un titre déjà lancé", async () => {
    const { player } = setup();
    player.playList(tracks, 3);
    expect(restorePlayback(player, savedAt(0, 1_000))).toBe(false);
    expect(player.snapshot.get().current?.key).toBe("jf:d");
  });

  it("des entrées neuves, jamais un uid d'une autre exécution ; l'ordre du contexte gardé", () => {
    const shuffled = revivePlayback(savedAt(0, 0, { original: [3, 2, 1, 0], shuffle: true }))!;
    expect(new Set(shuffled.queue.items.map((i) => i.uid)).size).toBe(4);
    expect(shuffled.queue.original).toEqual([3, 2, 1, 0].map((i) => shuffled.queue.items[i]!.uid));
    expect(shuffled.queue.shuffle).toBe(true);
    const again = revivePlayback(savedAt(0, 0))!;
    expect(again.queue.items.some((i) => shuffled.queue.items.some((j) => j.uid === i.uid))).toBe(false);
  });

  it("une sauvegarde illisible ne reprend rien", () => {
    for (const bad of [null, {}, { v: 2 }, { ...savedAt(0, 0), cursor: 9 }, { ...savedAt(0, 0), tracks: [{ key: 1 }] }, "x"]) {
      expect(revivePlayback(bad)).toBeNull();
    }
  });
});
