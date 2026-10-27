/**
 * Remettre une playlist importée dans l'ordre de sa source (relevé du 27/10) : l'ordre gardé ou la source
 * relue, chaque entrée reliée par LA règle du cœur, rien retiré ni dupliqué, le plan seul en `dryRun`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IndexRow } from "../index/indexTypes";
import type { PlaylistSourceRecord } from "./sourceRecord";
import { repairSourceOrder } from "./sourceRepair";

const { jf, store, index, forgotten } = vi.hoisted(() => ({
  jf: { items: [] as string[], canDelete: true, writes: [] as string[][] },
  store: new Map<string, PlaylistSourceRecord>(),
  index: new Map<string, IndexRow>(),
  forgotten: [] as string[],
}));

vi.mock("../playlists/playlistJellyfin", () => ({
  playlistFor: async () => ({ Id: "pl", Type: "Playlist", CanDelete: jf.canDelete, DateCreated: "2026-10-26T23:15:00.000Z" }),
  playlistEntries: async () => jf.items.map((itemId) => ({ entryId: `e-${itemId}`, itemId, plays: { count: 0, lastPlayedAt: null } })),
}));
vi.mock("../playlists/playlistService", () => ({
  reorderPlaylist: async (_user: string, _pl: string, entryIds: string[]) => {
    jf.writes.push(entryIds);
    jf.items = entryIds.map((e) => e.replace(/^e-/, ""));
    return { ok: true, value: true };
  },
}));
vi.mock("./sourceStore", () => ({
  readPlaylistSource: async (id: string) => store.get(id) ?? null,
  savePlaylistSource: async (record: PlaylistSourceRecord) => void store.set(record.playlistId, record),
}));
vi.mock("../listOrder/addedDates", () => ({ playlistScope: (id: string) => `playlist2:${id}`, forgetAddedDates: async (scope: string) => void forgotten.push(scope) }));
vi.mock("../index/indexQueries", () => ({
  rowsByIds: async (ids: string[]) => new Map(ids.filter((id) => index.has(id)).map((id) => [id, index.get(id)!])),
  albumTracks: async () => [],
  tracksByRecording: async () => [],
}));

const USER = "u".repeat(32);
const PL = "pl";
const deps = { fetcher: async () => ({ status: 500, url: "", body: "" }) } as never;

function indexed(id: string, title: string, artist = "Artiste"): void {
  index.set(id, { id, kind: "track", name: title, artists: [{ name: artist, mbid: null }], albumName: null, durationMs: 180_000, recordingMbid: null, albumArtist: null, discNumber: null, trackNumber: null } as unknown as IndexRow);
}

/** La source telle qu'une extension la lit (aucun réseau). */
const playlist = (titles: string[]) => ({ source: "youtube" as const, name: "Ma playlist", truncated: false, artworkUrl: null, tracks: titles.map((title, index) => ({ index, title, artists: ["Artiste"], album: null, durationMs: 180_000, isrc: null, sourceId: null })) });

beforeEach(() => {
  Object.assign(jf, { items: [], canDelete: true, writes: [] });
  store.clear();
  index.clear();
  forgotten.length = 0;
});

describe("remettre une playlist importée dans l'ordre de sa source", () => {
  it("la source relue : chaque entrée à son rang, une entrée hors source après sa voisine d'avant, rien de perdu", async () => {
    // Le désordre relevé : présents à la fin à l'envers, arrivées vers le haut.
    jf.items = ["s3", "manual", "s0", "s4", "s2", "s1"];
    for (const id of ["s0", "s1", "s2", "s3", "s4"]) indexed(id, id.toUpperCase());
    indexed("manual", "Autre chose", "Autre");
    const outcome = await repairSourceOrder(USER, PL, { kind: "playlist", playlist: playlist(["S0", "S1", "S2", "S3", "S4"]) }, false, deps);
    expect(outcome.ok).toBe(true);
    expect(jf.items).toEqual(["s0", "s1", "s2", "s3", "manual", "s4"]);
    expect(new Set(jf.items).size).toBe(6);
    if (!outcome.ok) return;
    expect(outcome.value).toMatchObject({ sourceTracks: 5, entries: 6, bound: 5, applied: true, unbound: [{ itemId: "manual", title: "Autre chose" }] });
    // Le relevé gardé (les arrivées suivantes se placent d'après lui), les dates d'ajout oubliées (reprises du rang).
    expect(store.get(PL)?.origin).toBe("repair");
    expect(store.get(PL)?.slots.map((s) => s.itemIds)).toEqual([["s0"], ["s1"], ["s2"], ["s3"], ["s4"]]);
    expect(store.get(PL)?.importedAt).toBe(Date.parse("2026-10-26T23:15:00.000Z"));
    expect(forgotten).toEqual(["playlist2:pl"]);
  });

  it("dryRun : le plan seul, rien d'écrit", async () => {
    jf.items = ["s1", "s0"];
    indexed("s0", "S0");
    indexed("s1", "S1");
    const outcome = await repairSourceOrder(USER, PL, { kind: "playlist", playlist: playlist(["S0", "S1"]) }, true, deps);
    expect(outcome).toEqual({ ok: true, value: expect.objectContaining({ moved: 2, applied: false, order: ["S0", "S1"] }) });
    expect(jf.writes).toEqual([]);
    expect(store.size).toBe(0);
    expect(forgotten).toEqual([]);
  });

  it("l'ordre gardé à l'import, sans réseau ; un doublon et une autre version suivent leur titre", async () => {
    store.set(PL, {
      playlistId: PL, userId: USER, source: "apple", url: "https://music.apple.com/fr/playlist/new/pl.u-new0000000000000", origin: "import", importedAt: 5_000,
      slots: ["S0", "S1", "S2"].map((title, rank) => ({ rank, title, artists: ["Artiste"], album: null, durationMs: 180_000, itemIds: rank === 1 ? ["s1"] : [] })),
    });
    jf.items = ["s2b", "s2", "s1", "s0"];
    indexed("s0", "S0");
    indexed("s2", "S2");
    indexed("s2b", "S2");
    const outcome = await repairSourceOrder(USER, PL, { kind: "kept" }, false, deps);
    expect(outcome.ok).toBe(true);
    expect(jf.items).toEqual(["s0", "s1", "s2b", "s2"]);
    expect(store.get(PL)).toMatchObject({ origin: "import", importedAt: 5_000, url: "https://music.apple.com/fr/playlist/new/pl.u-new0000000000000" });
  });

  it("une playlist d'avant sans relevé ni source donnée : dit, rien d'écrit ; celle d'un autre : refusée", async () => {
    jf.items = ["s0"];
    expect(await repairSourceOrder(USER, PL, { kind: "kept" }, false, deps)).toEqual({ ok: false, failure: "source_unknown" });
    jf.canDelete = false;
    expect(await repairSourceOrder(USER, PL, { kind: "kept" }, false, deps)).toEqual({ ok: false, failure: "forbidden" });
    expect(await repairSourceOrder(USER, PL, { kind: "url", url: "https://evil.example/pl/1" }, false, deps)).toEqual({ ok: false, failure: "forbidden" });
    jf.canDelete = true;
    expect(await repairSourceOrder(USER, PL, { kind: "url", url: "https://evil.example/pl/1" }, false, deps)).toEqual({ ok: false, failure: "unsupported" });
    expect(jf.writes).toEqual([]);
  });
});
