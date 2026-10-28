/**
 * La mécanique de la tenue à jour : hors ligne, rien ne casse et rien ne part ;
 * à la reconnexion (un relevé complet), tout se rattrape ; une copie d'ailleurs
 * n'est retirée qu'au passage qui suit la fin du transfert de sa version
 * Jellyfin ; les signaux en rafale font UN passage.
 */

import { describe, expect, it, vi } from "vitest";
import type { KeptMusicCollection, KeptMusicTrack } from "../core/musicLibrary";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { mergePasses, SyncRunner, type RunnerDeps } from "./syncRunner";
import type { SyncActions } from "./syncPlan";

const track = (key: string): MusicTrack => ({
  key, jellyfinId: key.startsWith("jf:") ? key.slice(3) : null, external: key.startsWith("jf:") ? null : { pluginId: "musique", id: "x" },
  title: key, artists: [], album: null, durationMs: 1000, trackNumber: null, discNumber: null, year: null, artworkUrl: null,
  mbids: { recording: null, release: null, releaseGroup: null, artists: [] }, availability: key.startsWith("jf:") ? "library" : "remote", format: null, favorite: false,
});

let id = 1;
const kept = (key: string, status: KeptMusicTrack["status"] = "complete"): KeptMusicTrack => ({
  fileId: id++, itemId: key, trackKey: key, origin: key.startsWith("jf:") ? "library" : "external", variant: "original", preset: null, status,
  errorCode: null, pausedByUser: false, bytesDone: 1, expectedSize: 1, title: key, artist: null, album: null, albumKey: null, discNumber: null,
  trackNumber: null, durationMs: 1000, coverRel: null, sourcePath: null, trackJson: JSON.stringify(track(key)), createdAt: 0,
});

const PL = "playlist:jf:p1";
const playlist = (keys: string[]): KeptMusicCollection => ({ key: PL, kind: "playlist", title: "P", subtitle: null, coverItemId: null, trackKeys: keys, updatedAt: 0 });

function bench(state: { tracks: KeptMusicTrack[]; collections: KeptMusicCollection[] }, reads: Partial<RunnerDeps> = {}) {
  const applied: SyncActions[] = [];
  const deps: RunnerDeps = {
    refresh: async () => undefined,
    state: () => state,
    readPending: async () => null,
    readPlaylists: async () => new Map(),
    readTwins: async () => new Map(),
    readWanted: async () => new Map(),
    canKeep: () => true,
    apply: async (a) => void applied.push(a),
    delayMs: 5,
    ...reads,
  };
  return { runner: new SyncRunner(deps), applied, deps };
}

describe("SyncRunner", () => {
  it("hors ligne (lectures sans réponse) : rien ne part ; à la reconnexion, le titre ajouté est gardé", async () => {
    const state = { tracks: [kept("jf:a")], collections: [playlist(["jf:a"])] };
    const offline = bench(state);
    offline.runner.start();
    await offline.runner.idle();
    expect(offline.applied).toEqual([]);
    const back = bench(state, { readPlaylists: async () => new Map([[PL, [track("jf:a"), track("jf:b")]]]) });
    back.runner.start();
    await back.runner.idle();
    expect(back.applied).toHaveLength(1);
    expect(back.applied[0]!.keep.map((t) => t.key)).toEqual(["jf:b"]);
  });

  it("la version Jellyfin d'abord ; l'ancienne copie part au passage qui suit la FIN de son transfert", async () => {
    const EXT = "ext:musique:x";
    const state = { tracks: [kept(EXT)], collections: [playlist([EXT])] };
    const { runner, applied } = bench(state);
    runner.signal({ kind: "twin", externalKey: EXT, track: track("jf:z") });
    await runner.idle();
    expect(applied.map((a) => [a.keep.map((t) => t.key), a.removeFileIds])).toEqual([[["jf:z"], []]]);
    state.tracks = [...state.tracks, kept("jf:z", "downloading")];
    runner.transferred();
    await runner.idle();
    expect(applied).toHaveLength(1);
    state.tracks = [state.tracks[0]!, { ...state.tracks[1]!, status: "complete" }];
    runner.transferred();
    await runner.idle();
    expect(applied[1]!.removeFileIds).toEqual([state.tracks[0]!.fileId]);
    expect(applied[1]!.saveCollections[0]!.trackKeys).toEqual(["jf:z"]);
  });

  it("une rafale de signaux d'une playlist : UNE relecture", async () => {
    const reads = vi.fn(async () => new Map<string, MusicTrack[]>());
    const { runner } = bench({ tracks: [kept("jf:a")], collections: [playlist(["jf:a"])] }, { readPlaylists: reads });
    for (let i = 0; i < 4; i++) runner.signal({ kind: "playlist", playlistId: "p1" });
    await runner.idle();
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it("un signal arrivé PENDANT un passage, déjà pris par lui : les suivants tournent encore (course vue au banc)", async () => {
    const reads = vi.fn(async () => new Map<string, MusicTrack[]>());
    let release: () => void = () => undefined;
    let slow = true;
    const { runner } = bench({ tracks: [kept("jf:a")], collections: [playlist(["jf:a"])] }, {
      readPlaylists: reads,
      readWanted: async () => {
        if (slow) await new Promise<void>((r) => (release = r));
        return new Map();
      },
    });
    runner.start();
    runner.signal({ kind: "playlist", playlistId: "p1" });
    await new Promise((r) => setTimeout(r, 1));
    slow = false;
    release();
    await runner.idle();
    const before = reads.mock.calls.length;
    runner.signal({ kind: "playlist", playlistId: "p1" });
    await runner.idle();
    expect(reads.mock.calls.length).toBe(before + 1);
  });

  it("arrêté (réglage éteint, profil, coupure) : plus rien ne s'applique", async () => {
    const { runner, applied } = bench({ tracks: [kept("jf:a")], collections: [playlist(["jf:a"])] }, { readPlaylists: async () => new Map([[PL, [track("jf:b")]]]) });
    runner.stop();
    runner.start();
    await runner.idle();
    expect(applied).toEqual([]);
  });

  it("fusion des passages : un relevé complet l'emporte, les playlists s'additionnent", () => {
    expect(mergePasses({ kind: "local" }, { kind: "full" })).toEqual({ kind: "full" });
    expect(mergePasses({ kind: "signals", playlists: new Set(["a"]), twins: false }, { kind: "signals", playlists: new Set(["b"]), twins: true })).toEqual({ kind: "signals", playlists: new Set(["a", "b"]), twins: true });
    expect(mergePasses({ kind: "signals", playlists: new Set(["a"]), twins: false }, { kind: "local" })).toEqual({ kind: "signals", playlists: new Set(["a"]), twins: false });
  });
});
