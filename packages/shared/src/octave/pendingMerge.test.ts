import { describe, expect, it } from "vitest";
import type { PendingMusicItem } from "../music";
import { externalTrack, libraryTrack } from "./fixtures";
import { mergeLiked, mergePlaylist } from "./pendingMerge";

function pendingItem(id: string, overrides: Partial<PendingMusicItem> = {}): PendingMusicItem {
  return {
    operationId: `op-${id}`,
    externalId: id,
    kind: "like",
    playlistId: null,
    position: null,
    track: externalTrack("sillon", id),
    state: "pending",
    createdAt: 1,
    ...overrides,
  };
}

describe("Titres likés + en attente", () => {
  it("l'attente paraît tout de suite, en tête, cœur plein, état « en attente »", () => {
    const rows = mergeLiked([libraryTrack("a")], [pendingItem("r1")]);
    expect(rows.map((r) => r.rowKey)).toEqual(["pending:op-r1", "jf:a"]);
    expect(rows[0]?.track.availability).toBe("pending");
    expect(rows[0]?.track.favorite).toBe(true);
  });

  it("cède sa place dès que l'enregistrement est dans la bibliothèque (aucun doublon)", () => {
    const rec = "5b11f4ce-a62d-471e-81fc-a69a8278c7da";
    const lib = libraryTrack("a", { mbids: { recording: rec, release: null, releaseGroup: null, artists: [] } });
    const waiting = pendingItem("r1", { track: externalTrack("sillon", "r1", { mbids: { recording: rec, release: null, releaseGroup: null, artists: [] } }) });
    expect(mergeLiked([lib], [waiting]).map((r) => r.rowKey)).toEqual(["jf:a"]);
  });

  it("un ajout de playlist n'entre pas dans les likés ; un échec reste visible comme tel", () => {
    const rows = mergeLiked([], [pendingItem("p", { kind: "playlistAdd", playlistId: "pl" }), pendingItem("f", { state: "failed" })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.pending).toEqual({ operationId: "op-f", failed: true });
  });
});

describe("Playlist + en attente", () => {
  const entries = ["a", "b", "c"].map((id, position) => ({ entryId: `e-${id}`, position, track: libraryTrack(id) }));

  it("l'attente se pose à la position voulue, la fin sans position", () => {
    const rows = mergePlaylist(entries, [
      pendingItem("x", { kind: "playlistAdd", playlistId: "pl", position: 1 }),
      pendingItem("y", { kind: "playlistAdd", playlistId: "pl", position: null }),
      pendingItem("z", { kind: "playlistAdd", playlistId: "autre", position: 0 }),
    ], "pl");
    expect(rows.map((r) => r.rowKey)).toEqual(["e-a", "pending:op-x", "e-b", "e-c", "pending:op-y"]);
    expect(rows[1]?.entryId).toBeNull();
  });
});
