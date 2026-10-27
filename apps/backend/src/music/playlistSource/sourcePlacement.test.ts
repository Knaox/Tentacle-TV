/**
 * Une insertion de l'extension dans une playlist importée, face à un Jellyfin SIMULÉ (ajout en fin, fin réécrite :
 * comme `playlistService.test.ts`). Relevé du 27/10 (une playlist importée d'Apple Music) : l'extension
 * envoyait la position calculée à l'import — le nombre de présents avant le titre —, la même pour tout un trou ;
 * le cœur la croyait : chaque arrivée du trou passait DEVANT la précédente. Avec l'ordre de la source gardé, chacune entre à SA place.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IndexRow } from "../index/indexTypes";
import { resetPlaylistMemoForTests } from "../playlists/playlistJellyfin";
import type { PlaylistSourceRecord } from "./sourceRecord";
import { insertFromHost } from "./sourcePlacement";

const { jf, store, index } = vi.hoisted(() => ({
  jf: { items: [] as string[] },
  store: new Map<string, PlaylistSourceRecord>(),
  index: new Map<string, IndexRow>(),
}));

vi.mock("../jellyfin/musicJellyfin", async (original) => ({
  ...(await original<typeof import("../jellyfin/musicJellyfin")>()),
  jfAdmin: async (path: string) => {
    if (path.startsWith("/Items/")) return { ok: true, data: { Id: "p", Type: "Playlist", CanDelete: true } };
    if (path.startsWith("/Playlists/")) return { ok: true, data: { Items: jf.items.map((Id) => ({ Id, PlaylistItemId: `e-${Id}` })) } };
    return { ok: false, status: 404 };
  },
  jfWrite: async (path: string, method: string) => {
    const url = new URL(`http://jf${path}`);
    if (method === "POST") for (const id of (url.searchParams.get("ids") ?? "").split(",")) if (!jf.items.includes(id)) jf.items.push(id);
    if (method === "DELETE") {
      const gone = new Set((url.searchParams.get("entryIds") ?? "").split(",").map((e) => e.replace(/^e-/, "")));
      jf.items = jf.items.filter((id) => !gone.has(id));
    }
    return { ok: true };
  },
}));
vi.mock("../events/musicLiveEvents", () => ({ tellPlaylistChanged: () => undefined }));
vi.mock("./sourceStore", () => ({
  readPlaylistSource: async (id: string) => store.get(id) ?? null,
  savePlaylistSource: async (record: PlaylistSourceRecord) => void store.set(record.playlistId, record),
}));
vi.mock("../index/indexQueries", () => ({
  rowsByIds: async (ids: string[]) => new Map(ids.filter((id) => index.has(id)).map((id) => [id, index.get(id)!])),
  albumTracks: async () => [],
  tracksByRecording: async () => [],
}));

const USER = "u".repeat(32);
const PL = "p";
const titles = ["S0", "S1", "S2", "S3", "S4"];

function record(origin: PlaylistSourceRecord["origin"] = "import"): PlaylistSourceRecord {
  const slots = titles.map((title, rank) => ({ rank, title, artists: ["Artiste"], album: null, durationMs: 180_000, itemIds: rank === 1 ? ["s1"] : [] }));
  return { playlistId: PL, userId: USER, source: "apple", url: null, origin, importedAt: 1_000_000, slots };
}

/** L'élément d'un titre, tel que l'index le voit. */
function indexed(id: string, title: string): void {
  index.set(id, { id, kind: "track", name: title, artists: [{ name: "Artiste", mbid: null }], albumName: null, durationMs: 180_000, recordingMbid: null, albumArtist: null, discNumber: null, trackNumber: null } as unknown as IndexRow);
}

beforeEach(() => {
  resetPlaylistMemoForTests();
  jf.items = ["s1"];
  store.clear();
  index.clear();
});

describe("une arrivée dans une playlist importée", () => {
  it("AVANT (aucun ordre de la source gardé) : la position de l'import, la même pour tout le trou — à l'envers", async () => {
    for (const id of ["s2", "s3", "s4"]) await insertFromHost(USER, PL, [id], 1, Number(id.slice(1)));
    expect(jf.items).toEqual(["s1", "s4", "s3", "s2"]);
  });

  it("l'ordre de la source gardé : chacune à SA place, quel que soit l'ordre des arrivées", async () => {
    store.set(PL, record());
    for (const id of ["s3", "s0", "s4", "s2"]) {
      const placed = await insertFromHost(USER, PL, [id], 1, Number(id.slice(1)));
      expect(placed.ok).toBe(true);
    }
    expect(jf.items).toEqual(["s0", "s1", "s2", "s3", "s4"]);
    expect(store.get(PL)!.slots.map((s) => s.itemIds)).toEqual([["s0"], ["s1"], ["s2"], ["s3"], ["s4"]]);
  });

  it("une extension d'avant (sans rang) : le titre de la source que l'élément EST, par la règle du cœur", async () => {
    store.set(PL, record());
    indexed("s4", "S4");
    indexed("s2", "S2");
    await insertFromHost(USER, PL, ["s4"], 0);
    await insertFromHost(USER, PL, ["s2"], 0);
    expect(jf.items).toEqual(["s1", "s2", "s4"]);
  });

  it("un relevé relu après coup (réparation) : un rang que la règle contredit cède au titre que l'élément est", async () => {
    store.set(PL, record("repair"));
    indexed("s3", "S3");
    const placed = await insertFromHost(USER, PL, ["s3"], 0, 0);
    expect(jf.items).toEqual(["s1", "s3"]);
    expect(placed).toEqual({ ok: true, value: 1 });
    // Un titre que la règle ne reconnaît pas (écrit autrement) : le rang donné fait foi.
    await insertFromHost(USER, PL, ["zz"], 0, 4);
    expect(jf.items).toEqual(["s1", "s3", "zz"]);
  });

  it("une autre version d'un titre déjà là (mise à niveau) : liée à lui, posée où l'extension l'a demandé", async () => {
    store.set(PL, record());
    jf.items = ["s1", "s2"];
    store.set(PL, { ...record(), slots: record().slots.map((s) => (s.rank === 2 ? { ...s, itemIds: ["s2"] } : s)) });
    indexed("s2b", "S2");
    await insertFromHost(USER, PL, ["s2b"], 1);
    expect(jf.items).toEqual(["s1", "s2b", "s2"]);
    expect(store.get(PL)!.slots[2]!.itemIds).toEqual(["s2", "s2b"]);
  });

  it("un titre que rien ne relie à la source : la position donnée, comme avant", async () => {
    store.set(PL, record());
    await insertFromHost(USER, PL, ["manual"], 0);
    expect(jf.items).toEqual(["manual", "s1"]);
  });
});
