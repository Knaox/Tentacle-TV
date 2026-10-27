/**
 * Une playlist de la bibliothèque se relit COMME ELLE SE MONTRE : ses entrées Jellyfin et ses titres hors
 * bibliothèque en attente (une playlist importée). Attentes illisibles : une playlist qui garde des titres d'ailleurs
 * reste intacte — jamais lue à moitié.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KeptMusicCollection } from "@tentacle-tv/offline-core";
import type { MusicPlaylistEntry, MusicTrack, PendingMusicItem } from "@tentacle-tv/shared/music";

const h = vi.hoisted(() => ({ entries: [] as unknown[], pending: null as unknown, pendingCalls: 0 }));

vi.mock("../keepMusic", () => ({ planLibrary: async () => new Map() }));
vi.mock("@tentacle-tv/api-client", () => ({
  musicApi: { playlist: async () => ({ entries: h.entries }) },
  fetchPendingMusic: async () => {
    h.pendingCalls += 1;
    if (h.pending === null) throw new Error("refus");
    return { items: h.pending };
  },
  fetchExternalPlaylist: async () => null,
  libraryMatchRequest: () => null,
}));

import { readPending, readPlaylists } from "./syncInputs";

const track = (key: string): MusicTrack => ({
  key, jellyfinId: key.startsWith("jf:") ? key.slice(3) : null,
  external: key.startsWith("ext:") ? { pluginId: key.split(":")[1]!, id: key.split(":").slice(2).join(":") } : null,
  title: key, artists: [], album: null, durationMs: 1000, trackNumber: null, discNumber: null, year: null, artworkUrl: null,
  mbids: { recording: null, release: null, releaseGroup: null, artists: [] }, availability: key.startsWith("jf:") ? "library" : "remote", format: null, favorite: false,
});
const entry = (key: string, position: number): MusicPlaylistEntry => ({ entryId: `e-${key}`, position, track: track(key) });
const imported = (key: string, position: number, formerIds?: string[]): PendingMusicItem => ({
  operationId: `op-${key}`, externalId: key.split(":").slice(2).join(":"), kind: "playlistAdd", playlistId: "p1", position,
  track: track(key), state: "pending", createdAt: position, imported: true, ...(formerIds ? { formerIds } : {}),
});
const collection = (keys: string[]): KeptMusicCollection => ({ key: "playlist:jf:p1", kind: "playlist", title: "New", subtitle: null, coverItemId: null, trackKeys: keys, updatedAt: 0 });
const SILLON = { pluginId: "sillon", name: "Sillon", music: { search: "/s", resolve: "/r", pending: "/music/pending" } };

beforeEach(() => {
  h.entries = [entry("jf:a", 0), entry("jf:b", 1)];
  h.pending = [imported("ext:sillon:ytm:t:x", 1)];
  h.pendingCalls = 0;
});

describe("readPlaylists — une playlist importée, relue avec ses titres hors bibliothèque", () => {
  it("les entrées Jellyfin ET les attentes, chacune à sa place", async () => {
    const pending = await readPending(SILLON);
    const out = await readPlaylists([collection(["jf:a", "ext:sillon:ytm:t:x", "jf:b"])], SILLON, null, pending);
    expect(out.get("playlist:jf:p1")!.map((t) => t.key)).toEqual(["jf:a", "ext:sillon:ytm:t:x", "jf:b"]);
  });

  it("attentes illisibles (refus, extension coupée ou pas encore connue) : la playlist qui garde des titres d'ailleurs n'est PAS relue", async () => {
    h.pending = null;
    expect(await readPending(SILLON)).toBeNull();
    expect(await readPending(null)).toBeNull();
    const kept = collection(["jf:a", "ext:sillon:ytm:t:x", "jf:b"]);
    expect((await readPlaylists([kept], SILLON, null, null)).has(kept.key)).toBe(false);
    expect((await readPlaylists([kept], null, null, null)).has(kept.key)).toBe(false);
  });

  it("une playlist sans titre d'ailleurs gardé se relit quand même (ses ajouts de la bibliothèque comptent)", async () => {
    const out = await readPlaylists([collection(["jf:a"])], null, null, null);
    expect(out.get("playlist:jf:p1")!.map((t) => t.key)).toEqual(["jf:a", "jf:b"]);
  });

  it("des titres d'une AUTRE extension que celle qu'on lit : intacte", async () => {
    const kept = collection(["jf:a", "ext:autre:ytm:t:y"]);
    expect((await readPlaylists([kept], SILLON, null, await readPending(SILLON))).has(kept.key)).toBe(false);
  });

  it("une extension sans attentes (`pending` non déclaré) : aucune requête, rien d'illisible n'est lu", async () => {
    expect(await readPending({ ...SILLON, music: { search: "/s", resolve: "/r" } })).toBeNull();
    expect(h.pendingCalls).toBe(0);
  });
});
