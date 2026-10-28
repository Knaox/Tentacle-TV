/**
 * Les gestes communs : la collection TOUJOURS entière, le refus faute de place,
 * le compte de l'appareil seulement (sans lui, rien ne part).
 */

import { describe, expect, it, vi } from "vitest";
import { createKeepActions, type KeepEnginePort } from "./keepActions";
import { keptTrack, musicTrack } from "./testing/fixtures";

function port(partial: Partial<KeepEnginePort> = {}): KeepEnginePort & { enqueued: unknown[] } {
  const enqueued: unknown[] = [];
  return {
    enqueued,
    owner: () => ({ userId: "compte" }),
    fetchPlan: async (body) => ({ tracks: body.ids.map((id) => ({ id, variant: "original" as const, preset: null, path: `/api/downloads/original/${id}`, container: "flac", expectedSize: 10, estimatedSize: 10 })), refused: [] }),
    enqueue: async (_u, items, collection) => (enqueued.push({ items, collection }), { accepted: true, neededBytes: 0 }),
    remove: vi.fn(async () => undefined),
    saveCollections: vi.fn(async () => undefined),
    refresh: vi.fn(async () => undefined),
    ...partial,
  };
}

describe("createKeepActions", () => {
  it("un lot gardé, la collection entière (même partiellement gardée)", async () => {
    const p = port();
    const outcome = await createKeepActions(p).keepTracks([musicTrack("jf:a")], null, { key: "playlist:jf:p", kind: "playlist", title: "P", subtitle: null, trackKeys: ["jf:a", "jf:b"] });
    expect(outcome).toEqual({ kind: "queued", count: 1, refused: 0 });
    expect(p.enqueued[0]).toMatchObject({ collection: { key: "playlist:jf:p", coverItemId: null, trackKeys: ["jf:a", "jf:b"] } });
    expect(p.refresh).toHaveBeenCalled();
  });

  it("pas assez de place : refusé en bloc", async () => {
    const p = port({ enqueue: async () => ({ accepted: false, neededBytes: 42 }) });
    expect(await createKeepActions(p).keepTracks([musicTrack("jf:a")], null)).toEqual({ kind: "noSpace", neededBytes: 42 });
  });

  it("sans compte de l'appareil, ou sans rien de gardable : échec, rien ne part", async () => {
    expect(await createKeepActions(port({ owner: () => null })).keepTracks([musicTrack("jf:a")], null)).toEqual({ kind: "failed" });
    expect(await createKeepActions(port()).keepTracks([musicTrack("ext:s:a")], null)).toEqual({ kind: "failed" });
  });

  it("retirer : les fichiers et la collection, au nom du compte", async () => {
    const p = port();
    expect(await createKeepActions(p).removeKept([keptTrack("jf:a", { fileId: 7 })], "album:x")).toBe(true);
    expect(p.remove).toHaveBeenCalledWith("compte", [7], "album:x");
    expect(await createKeepActions(p).removeKeptFiles([])).toBe(false);
    expect(await createKeepActions(p).saveKeptCollections([{ key: "k", kind: "track", title: "t", subtitle: null, coverItemId: null, trackKeys: ["jf:a"], updatedAt: 3 }], [])).toBe(true);
    expect(p.saveCollections).toHaveBeenCalledWith("compte", [{ key: "k", kind: "track", title: "t", subtitle: null, coverItemId: null, trackKeys: ["jf:a"] }], []);
  });
});
