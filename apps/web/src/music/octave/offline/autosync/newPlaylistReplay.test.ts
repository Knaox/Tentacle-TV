/**
 * Le relevé du 27/10 (bureau de Damien, playlist importée « New »), REJOUÉ sous une forme neutre : 153 titres de
 * la bibliothèque, 36 hors bibliothèque gardés, dont 6 encore sous leur fiche d'import (`imp:`). Sillon en a depuis
 * rapproché deux d'une vidéo (`imp:` → `ytm:t:`) ; Damien les a gardés une seconde fois, à la main.
 *
 * - La lecture d'avant (entrées Jellyfin seules) aurait effacé les 36 titres hors bibliothèque au premier relevé
 *   complet (prochaine ouverture de l'app).
 * - Désormais : rien n'est effacé, les deux doublons s'en vont seuls (l'ancienne copie part, la nouvelle reste),
 *   un titre qui change d'identité est regardé sous la nouvelle AVANT que l'ancienne parte, une arrivée de Lidarr
 *   est gardée seule.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KeptMusicCollection, KeptMusicTrack } from "@tentacle-tv/offline-core";
import type { MusicPlaylistEntry, MusicTrack, PendingMusicItem } from "@tentacle-tv/shared/music";

const h = vi.hoisted(() => ({ entries: [] as unknown[], pending: [] as unknown[] }));
vi.mock("../keepMusic", () => ({ planLibrary: async () => new Map() }));
vi.mock("@tentacle-tv/api-client", () => ({
  musicApi: { playlist: async () => ({ entries: h.entries }) },
  fetchPendingMusic: async () => ({ items: h.pending }),
  fetchExternalPlaylist: async () => null,
  libraryMatchRequest: () => null,
}));

import { holdKey, planSync } from "@tentacle-tv/offline-core/music";
import { readPending, readPlaylists } from "./syncInputs";
import { SyncRunner } from "@tentacle-tv/offline-core/music";
import type { SyncActions } from "@tentacle-tv/offline-core/music";

const SILLON = { pluginId: "sillon", name: "Sillon", music: { search: "/s", resolve: "/r", pending: "/music/pending", offline: "/music/offline" } };
const PL = "playlist:jf:p1";
const ext = (id: string) => `ext:sillon:${id}`;

const track = (key: string): MusicTrack => ({
  key, jellyfinId: key.startsWith("jf:") ? key.slice(3) : null, external: key.startsWith("ext:") ? { pluginId: "sillon", id: key.slice("ext:sillon:".length) } : null,
  title: key, artists: [], album: null, durationMs: 200_000, trackNumber: null, discNumber: null, year: null, artworkUrl: null,
  mbids: { recording: null, release: null, releaseGroup: null, artists: [] }, availability: key.startsWith("jf:") ? "library" : "remote", format: null, favorite: false,
});
let nextFile = 1;
const kept = (key: string, status: KeptMusicTrack["status"] = "complete"): KeptMusicTrack => ({
  fileId: nextFile++, itemId: key, trackKey: key, origin: key.startsWith("jf:") ? "library" : "external", variant: "original", preset: null, status,
  errorCode: null, pausedByUser: false, bytesDone: 1, expectedSize: 1, title: key, artist: null, album: null, albumKey: null, discNumber: null,
  trackNumber: null, durationMs: 200_000, coverRel: null, sourcePath: null, trackJson: JSON.stringify(track(key)), createdAt: 0,
});
const collection = (key: string, kind: KeptMusicCollection["kind"], trackKeys: string[]): KeptMusicCollection => ({ key, kind, title: key, subtitle: null, coverItemId: null, trackKeys, updatedAt: 0 });

/** La playlist telle qu'elle était au lot (21:30:47) : 153 + 36, dont `imp:i0`…`imp:i5`. */
function scene() {
  const library = Array.from({ length: 153 }, (_, i) => `jf:${String(i).padStart(32, "0")}`);
  const outside = [...Array.from({ length: 30 }, (_, i) => ext(`ytm:t:v${i}`)), ...Array.from({ length: 6 }, (_, i) => ext(`imp:i${i}`))];
  const keys = [...library, ...outside];
  const tracks = keys.map((k) => kept(k));
  // Rapprochés depuis par Sillon, et gardés une seconde fois à la main (collection `track:`).
  const manual = [kept(ext("ytm:t:r0")), kept(ext("ytm:t:r1"))];
  const collections = [collection(PL, "playlist", keys), collection(holdKey(ext("ytm:t:r0")), "track", [ext("ytm:t:r0")]), collection(holdKey(ext("ytm:t:r1")), "track", [ext("ytm:t:r1")])];
  return { library, outside, state: { tracks: [...tracks, ...manual], collections } };
}

const entries = (keys: string[]): MusicPlaylistEntry[] => keys.map((k, position) => ({ entryId: `e${position}`, position, track: track(k) }));
/** Les attentes de Sillon AUJOURD'HUI : `i0`, `i1` (et `i2` s'il le faut) sous leur vidéo, avec leur fiche d'hier. */
function pendingNow(outside: string[], renamed: Record<string, string>, withFormer = true): PendingMusicItem[] {
  return outside.map((key, i) => {
    const id = key.slice("ext:sillon:".length);
    const now = renamed[id] ?? id;
    return {
      operationId: `op${i}`, externalId: now, kind: "playlistAdd", playlistId: "p1", position: 153, track: track(ext(now)), state: "pending",
      createdAt: i, imported: true, ...(withFormer && now !== id ? { formerIds: [id] } : {}),
    };
  });
}

async function fullPass(state: { tracks: KeptMusicTrack[]; collections: KeptMusicCollection[] }): Promise<SyncActions[]> {
  const applied: SyncActions[] = [];
  const runner = new SyncRunner({
    refresh: async () => undefined,
    state: () => state,
    readPending: () => readPending(SILLON),
    readPlaylists: (collections, only, pending) => readPlaylists(collections, SILLON, only, pending),
    readTwins: async () => new Map(),
    readWanted: async () => new Map(),
    canKeep: () => true,
    apply: async (a) => void applied.push(a),
    delayMs: 1,
  });
  runner.start();
  await runner.idle();
  return applied;
}

const fileOf = (state: { tracks: KeptMusicTrack[] }, key: string) => state.tracks.find((t) => t.trackKey === key)!.fileId;
const RENAMED = { "imp:i0": "ytm:t:r0", "imp:i1": "ytm:t:r1" };

beforeEach(() => {
  h.entries = [];
  h.pending = [];
});

describe("« New » rejouée — la tenue à jour d'une playlist importée gardée", () => {
  it("le constat : relue SANS ses attentes (la lecture d'avant), la playlist semblait avoir perdu ses 36 titres hors bibliothèque", () => {
    const { library, state } = scene();
    const before = planSync({ kept: state.tracks, collections: state.collections, playlists: new Map([[PL, library.map(track)]]), twins: new Map(), wanted: new Map(), canKeep: () => true });
    expect(before.removeFileIds).toHaveLength(36);
  });

  it("relue avec ses attentes : rien n'est effacé, les deux doublons partent seuls, la collection suit Sillon", async () => {
    const { library, outside, state } = scene();
    h.entries = entries(library);
    h.pending = pendingNow(outside, RENAMED);
    const [actions] = await fullPass(state);
    expect(actions!.keep).toEqual([]);
    expect(actions!.removeFileIds.sort()).toEqual([fileOf(state, ext("imp:i0")), fileOf(state, ext("imp:i1"))].sort());
    const saved = actions!.saveCollections.find((c) => c.key === PL)!;
    expect(saved.trackKeys).toHaveLength(189);
    expect(new Set(saved.trackKeys).size).toBe(189);
    expect(saved.trackKeys).toContain(ext("ytm:t:r0"));
    expect(saved.trackKeys).not.toContain(ext("imp:i0"));
    expect(actions!.removeCollections).toEqual([]);
  });

  it("un Sillon d'avant (sans `formerIds`) : les doublons partent aussi — la copie d'hier n'est plus dans la playlist", async () => {
    const { library, outside, state } = scene();
    h.entries = entries(library);
    h.pending = pendingNow(outside, RENAMED, false);
    const [actions] = await fullPass(state);
    expect(actions!.removeFileIds.sort()).toEqual([fileOf(state, ext("imp:i0")), fileOf(state, ext("imp:i1"))].sort());
    expect(actions!.keep).toEqual([]);
  });

  it("une identité qui change SANS copie sous la nouvelle : celle d'aujourd'hui est gardée d'abord, l'ancienne part une fois elle complète", async () => {
    const { library, outside, state } = scene();
    h.entries = entries(library);
    h.pending = pendingNow(outside, { ...RENAMED, "imp:i2": "ytm:t:r2" });
    const [first] = await fullPass(state);
    expect(first!.keep.map((t) => t.key)).toEqual([ext("ytm:t:r2")]);
    expect(first!.removeFileIds).not.toContain(fileOf(state, ext("imp:i2")));
    state.tracks.push(kept(ext("ytm:t:r2")));
    state.collections = state.collections.map((c) => (c.key === PL ? first!.saveCollections.find((s) => s.key === PL)! : c));
    const [second] = await fullPass(state);
    expect(second!.removeFileIds).toContain(fileOf(state, ext("imp:i2")));
    expect(second!.keep).toEqual([]);
  });

  it("une arrivée de Lidarr (le titre entre dans la bibliothèque, à sa place) et un ajout à la playlist : gardés seuls", async () => {
    const { library, outside, state } = scene();
    const arrived = `jf:${"a".repeat(32)}`;
    const added = `jf:${"b".repeat(32)}`;
    h.entries = entries([...library, arrived, added]);
    // `imp:i3` a quitté les attentes : Sillon l'a remplacé par l'élément Jellyfin (`music:resolved` → jumeau).
    h.pending = pendingNow(outside.filter((k) => k !== ext("imp:i3")), RENAMED);
    const applied: SyncActions[] = [];
    const runner = new SyncRunner({
      refresh: async () => undefined, state: () => state, readPending: () => readPending(SILLON),
      readPlaylists: (collections, only, pending) => readPlaylists(collections, SILLON, only, pending),
      readTwins: async () => new Map(), readWanted: async () => new Map(), canKeep: () => true, apply: async (a) => void applied.push(a), delayMs: 1,
    });
    runner.signal({ kind: "twin", externalKey: ext("imp:i3"), track: track(arrived) });
    runner.signal({ kind: "playlist", playlistId: "p1" });
    await runner.idle();
    expect(applied[0]!.keep.map((t) => t.key).sort()).toEqual([arrived, added].sort());
    // La copie d'ailleurs RESTE tant que sa version Jellyfin n'est pas complète.
    expect(applied[0]!.removeFileIds).not.toContain(fileOf(state, ext("imp:i3")));
  });

  it("des attentes changées (`music:pending`) relisent les playlists de la bibliothèque gardées, une fois", async () => {
    const { library, outside, state } = scene();
    h.entries = entries(library);
    h.pending = pendingNow(outside, RENAMED);
    const reads = vi.fn((collections: readonly KeptMusicCollection[], only: ReadonlySet<string> | null, pending: readonly PendingMusicItem[] | null) => readPlaylists(collections, SILLON, only, pending));
    const runner = new SyncRunner({
      refresh: async () => undefined, state: () => state, readPending: () => readPending(SILLON), readPlaylists: reads,
      readTwins: async () => new Map(), readWanted: async () => new Map(), canKeep: () => true, apply: async () => undefined, delayMs: 1,
    });
    for (let i = 0; i < 3; i++) runner.signal({ kind: "pending" });
    await runner.idle();
    expect(reads).toHaveBeenCalledTimes(1);
    expect([...(reads.mock.calls[0]![1] ?? [])]).toEqual(["p1"]);
  });
});
