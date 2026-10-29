import { describe, expect, it } from "vitest";
import type { PlaybackSource } from "@tentacle-tv/shared/music";
import { OctavePlayer, PlaybackReporter, SourceCache, type SyncStorage } from "@tentacle-tv/shared/octave";
import { createFakeEngine, libraryTrack } from "@tentacle-tv/shared/octave/testing";
import { attachPlayerResume, OCTAVE_PLAYER_KEY, readSavedPlayback } from "./playerResume";

/** La session du lecteur reprise en pause : la même règle pour le web, le bureau et le mobile. */

const sourceOf = (key: string): PlaybackSource => ({ trackKey: key, url: `/s/${key}`, origin: "library", complete: true, sizeBytes: null, durationMs: 200_000, format: null, replayGain: null, expiresAt: null });

function newPlayer() {
  const engine = createFakeEngine();
  const sources = new SourceCache({ library: async (id) => sourceOf(`jf:${id}`), external: async () => null, now: () => 0 });
  const reporter = new PlaybackReporter({ library: () => {}, externalPlayed: () => {}, now: () => 0 });
  return new OctavePlayer({ engine, sources, reporter, prefetchExternal: () => {}, skipDelayMs: 0 });
}

function memory(): SyncStorage & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

describe("reprise de la session du lecteur", () => {
  it("gardée à l'arrière-plan et au détachement, reprise en pause par la même identité", () => {
    const storage = memory();
    let hide: () => void = () => undefined;
    const deps = { storage, ownerNow: () => "srv|u1", onHide: (save: () => void) => ((hide = save), () => undefined) };
    const first = newPlayer();
    const detach = attachPlayerResume(first, "srv|u1", deps);
    first.playList(["a", "b"].map((id) => libraryTrack(id)), 1);
    hide();
    expect(readSavedPlayback(storage, "srv|u1")).not.toBeNull();
    detach();

    const second = newPlayer();
    attachPlayerResume(second, "srv|u1", deps);
    expect(second.snapshot.get().current?.key).toBe("jf:b");
    expect(second.snapshot.get().wantsPlay).toBe(false);
  });

  it("jamais au nom d'une session partie, rien sans identité", () => {
    const storage = memory();
    const player = newPlayer();
    const detach = attachPlayerResume(player, "srv|u1", { storage, ownerNow: () => "srv|u2", onHide: () => () => undefined });
    player.playList([libraryTrack("a")], 0);
    detach();
    expect(storage.data[OCTAVE_PLAYER_KEY]).toBeUndefined();
    expect(attachPlayerResume(player, null, { storage, ownerNow: () => null, onHide: () => () => undefined })).toBeTypeOf("function");
  });
});

describe("reprise : seulement dans le même lancement (fermeture complète = repartir de zéro)", () => {
  const quiet = (storage: SyncStorage, launch: string) => ({ storage, ownerNow: () => "srv|u1", onHide: () => () => undefined, launchId: () => launch });

  it("un nouveau lancement ne reprend rien, même avec une session gardée", () => {
    const storage = memory();
    const first = newPlayer();
    const detach = attachPlayerResume(first, "srv|u1", quiet(storage, "L1"));
    first.playList(["a", "b"].map((id) => libraryTrack(id)), 1);
    detach();
    expect(readSavedPlayback(storage, "srv|u1", "L1")).not.toBeNull();

    const relaunched = newPlayer();
    attachPlayerResume(relaunched, "srv|u1", quiet(storage, "L2"));
    expect(relaunched.snapshot.get().current).toBeNull();
    expect(relaunched.snapshot.get().queue.items).toEqual([]);
    expect(readSavedPlayback(storage, "srv|u1", "L2")).toBeNull();
  });

  it("le même lancement (sortie d'Octave puis retour, rechargement) reprend en pause", () => {
    const storage = memory();
    const first = newPlayer();
    const detach = attachPlayerResume(first, "srv|u1", quiet(storage, "L1"));
    first.playList(["a", "b"].map((id) => libraryTrack(id)), 0);
    detach();
    const again = newPlayer();
    attachPlayerResume(again, "srv|u1", quiet(storage, "L1"));
    expect(again.snapshot.get().current?.key).toBe("jf:a");
  });

  it("une session gardée par un build d'avant (sans lancement) n'est jamais reprise", () => {
    const storage = memory();
    const first = newPlayer();
    const detach = attachPlayerResume(first, "srv|u1", quiet(storage, "L1"));
    first.playList([libraryTrack("a")], 0);
    detach();
    const raw = JSON.parse(storage.data[OCTAVE_PLAYER_KEY]!) as Record<string, { launch?: string }>;
    delete raw["srv|u1"]!.launch;
    storage.data[OCTAVE_PLAYER_KEY] = JSON.stringify(raw);
    const next = newPlayer();
    attachPlayerResume(next, "srv|u1", quiet(storage, "L1"));
    expect(next.snapshot.get().current).toBeNull();
  });

  it("« Arrêter » efface la session gardée : un retour dans Octave ne reprend rien", () => {
    const storage = memory();
    const first = newPlayer();
    const detach = attachPlayerResume(first, "srv|u1", quiet(storage, "L1"));
    first.playList(["a", "b"].map((id) => libraryTrack(id)), 0);
    first.clear();
    detach();
    expect(readSavedPlayback(storage, "srv|u1", "L1")).toBeNull();
    const again = newPlayer();
    attachPlayerResume(again, "srv|u1", quiet(storage, "L1"));
    expect(again.snapshot.get().current).toBeNull();
  });
});
