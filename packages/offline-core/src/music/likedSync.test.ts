/**
 * « Titres likés » gardés : relue page par page, réveillée par un cœur, tenue à
 * jour comme une playlist (un cœur retiré libère le titre que rien d'autre ne retient).
 */

import { describe, expect, it } from "vitest";
import type { MusicPage, MusicTrack } from "@tentacle-tv/shared/music";
import { planSync } from "./syncPlan";
import { LIKED_COLLECTION_KEY, playlistTarget, readLikedWith, readPlaylistsWith, type SyncReadApi } from "./syncInputs";
import { onSyncSignal, signalMusicEvent, type SyncSignal } from "./syncSignals";
import { keptTrack, musicTrack } from "./testing/fixtures";

function api(pages: MusicTrack[][]): SyncReadApi {
  return {
    playlist: async () => ({ entries: [] }),
    externalPlaylist: async () => null,
    pending: async () => ({ items: [] }),
    matchRequest: () => null,
    match: async () => ({ tracks: [] }),
    plan: async () => ({ tracks: [], refused: [] }),
    liked: async (cursor): Promise<MusicPage<MusicTrack>> => {
      const index = cursor === null ? 0 : Number(cursor);
      return { items: pages[index] ?? [], total: null, cursor: index + 1 < pages.length ? String(index + 1) : null };
    },
  };
}

const COLLECTION = { key: LIKED_COLLECTION_KEY, kind: "playlist" as const, title: "Titres likés", subtitle: null, coverItemId: null, trackKeys: ["jf:a", "jf:b"], updatedAt: 0 };

describe("Titres likés gardés", () => {
  it("la clé de la collection désigne les likés, jamais une playlist Jellyfin", () => {
    expect(playlistTarget(LIKED_COLLECTION_KEY)).toEqual({ kind: "liked", id: "liked" });
  });

  it("toutes les pages, bornées ; illisible : rien", async () => {
    const liked = await readLikedWith(api([[musicTrack("jf:a")], [musicTrack("jf:c")]]));
    expect(liked?.map((t) => t.key)).toEqual(["jf:a", "jf:c"]);
    expect(await readLikedWith({ liked: async () => { throw new Error("hors ligne"); } })).toBeNull();
    expect(await readLikedWith({})).toBeNull();
  });

  it("un cœur posé garde, un cœur retiré libère", async () => {
    const playlists = await readPlaylistsWith(api([[musicTrack("jf:a"), musicTrack("jf:c")]]), [COLLECTION], null);
    const plan = planSync({
      kept: [keptTrack("jf:a", { fileId: 1 }), keptTrack("jf:b", { fileId: 2 })],
      collections: [COLLECTION],
      playlists,
      twins: new Map(),
      wanted: new Map(),
      canKeep: () => true,
    });
    expect(plan.keep.map((t) => t.key)).toEqual(["jf:c"]);
    expect(plan.removeFileIds).toEqual([2]);
    expect(plan.saveCollections[0]?.trackKeys).toEqual(["jf:a", "jf:c"]);
  });

  it("un cœur réveille la tenue à jour des likés", () => {
    const seen: SyncSignal[] = [];
    const off = onSyncSignal((s) => seen.push(s));
    signalMusicEvent({ type: "music:userdata", changes: [{ jellyfinId: "a", favorite: true }] });
    signalMusicEvent({ type: "music:userdata", changes: [] });
    off();
    expect(seen).toEqual([{ kind: "playlist", playlistId: "liked" }]);
  });
});
