import { describe, expect, it } from "vitest";
import type { PendingMusicItem } from "../music";
import { externalTrack, libraryTrack } from "./fixtures";
import { mergeLiked, mergePlaylist, playlistHasTrack, playlistOccurrences, playlistTrackTotal } from "./pendingMerge";

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
    expect(rows[0]?.pending).toEqual({ operationId: "op-f", failed: true, note: null });
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

describe("un titre jamais deux fois dans « Titres likés » (25/10)", () => {
  it("une attente dont le jumeau (même titre, même artiste) est déjà un favori s'efface, même sans MBID commun", () => {
    const lib = libraryTrack("a", { title: "Worth It", artists: [{ name: "Corbin", mbid: null, jellyfinId: null }] });
    const twin = pendingItem("w", { track: externalTrack("sillon", "w", { title: "Worth it", artists: [{ name: "CORBIN", mbid: null, jellyfinId: null }], mbids: { recording: "cle-de-l-extension", release: null, releaseGroup: null, artists: [] } }) });
    expect(mergeLiked([lib], [twin]).map((r) => r.rowKey)).toEqual(["jf:a"]);
  });

  it("deux attentes du même titre n'en font qu'une rangée (la plus ancienne)", () => {
    const track = externalTrack("sillon", "same");
    const rows = mergeLiked([], [pendingItem("1", { operationId: "op-old", track, createdAt: 1 }), pendingItem("2", { operationId: "op-new", track, createdAt: 2 })]);
    expect(rows.map((r) => r.rowKey)).toEqual(["pending:op-old"]);
  });

  it("la note de l'extension accompagne la rangée", () => {
    const rows = mergeLiked([], [pendingItem("n", { state: "failed", note: "Ne peut pas entrer dans la bibliothèque." })]);
    expect(rows[0]?.pending?.note).toBe("Ne peut pas entrer dans la bibliothèque.");
  });
});

describe("doublons de playlist (25/10)", () => {
  const entry = (id: string, position: number) => ({ entryId: `e-${id}`, position, track: libraryTrack(id) });

  it("un titre déjà présent — entrée ou attente — est reconnu ; un autre ne l'est pas", () => {
    const entries = [entry("a", 0)];
    const waiting = [pendingItem("r", { kind: "playlistAdd", playlistId: "pl", position: 1 })];
    expect(playlistHasTrack(entries, [], "pl", libraryTrack("a"))).toBe(true);
    expect(playlistHasTrack([], waiting, "pl", externalTrack("sillon", "r"))).toBe(true);
    expect(playlistHasTrack([], waiting, "autre", externalTrack("sillon", "r"))).toBe(false);
    expect(playlistHasTrack(entries, waiting, "pl", libraryTrack("b"))).toBe(false);
  });

  it("un doublon CONFIRMÉ en attente garde sa rangée à côté de l'entrée existante", () => {
    const rec = "5b11f4ce-a62d-471e-81fc-a69a8278c7da";
    const mbids = { recording: rec, release: null, releaseGroup: null, artists: [] };
    const entries = [{ entryId: "e-a", position: 0, track: libraryTrack("a", { mbids }) }];
    const dup = pendingItem("r", { kind: "playlistAdd", playlistId: "pl", position: 1, duplicate: true, track: externalTrack("sillon", "r", { mbids }) });
    expect(mergePlaylist(entries, [dup], "pl").map((r) => r.rowKey)).toEqual(["e-a", "pending:op-r"]);
    expect(mergePlaylist(entries, [{ ...dup, duplicate: undefined }], "pl").map((r) => r.rowKey)).toEqual(["e-a"]);
  });

  it("retirer : les entrées de Jellyfin et les attentes qui portent le titre", () => {
    const entries = [entry("a", 0), entry("b", 1), entry("a", 2)];
    const waiting = [pendingItem("x", { kind: "playlistAdd", playlistId: "pl", track: libraryTrack("a") })];
    expect(playlistOccurrences(entries, waiting, "pl", libraryTrack("a"))).toEqual({ entryIds: ["e-a", "e-a"], operationIds: ["op-x"] });
  });
});


describe("une entrée IMPORTÉE (importTracks)", () => {
  it("garde la disponibilité que l'extension lui donne, à sa place dans la playlist", () => {
    const remote = { ...externalTrack("sillon", "imp-1"), availability: "remote" as const };
    const item = pendingItem("imp-1", { kind: "playlistAdd", playlistId: "pl", position: 1, track: remote, imported: true });
    const rows = mergePlaylist([{ entryId: "e-a", position: 0, track: libraryTrack("a") }, { entryId: "e-b", position: 1, track: libraryTrack("b") }], [item], "pl");
    expect(rows.map((r) => r.rowKey)).toEqual(["e-a", "pending:op-imp-1", "e-b"]);
    expect(rows[1]?.track.availability).toBe("remote");
  });

  it("une attente qui dit son rang dans la source : juste après celui qui la précède, sa position d'import ignorée (27/10)", () => {
    // La playlist telle que Jellyfin la tient (rangs 4, 1, 6 : l'ordre faux d'avant la réparation) ; positions figées à 0.
    const entries = [
      { entryId: "e-w", position: 0, track: libraryTrack("w"), sourceIndex: 4 },
      { entryId: "e-b", position: 1, track: libraryTrack("b"), sourceIndex: 1 },
      { entryId: "e-m", position: 2, track: libraryTrack("m"), sourceIndex: 6 },
    ];
    const at = (id: string, sourceIndex: number) => pendingItem(id, { kind: "playlistAdd", playlistId: "pl", position: 0, imported: true, sourceIndex, createdAt: 10 - sourceIndex });
    const rows = mergePlaylist(entries, [at("s5", 5), at("s2", 2), at("s3", 3), at("s9", 9), at("s0", 0)], "pl");
    // s0 (aucun rang avant lui) : juste avant le rang 1 ; deux attentes à la même place : par rang.
    expect(rows.map((r) => r.rowKey)).toEqual(["e-w", "pending:op-s0", "pending:op-s5", "e-b", "pending:op-s2", "pending:op-s3", "e-m", "pending:op-s9"]);
  });

  it("des entrées sans rang (serveur d'avant) : la position de l'attente, comme avant", () => {
    const item = pendingItem("s2", { kind: "playlistAdd", playlistId: "pl", position: 1, imported: true, sourceIndex: 2 });
    const rows = mergePlaylist([{ entryId: "e-a", position: 0, track: libraryTrack("a") }, { entryId: "e-b", position: 1, track: libraryTrack("b") }], [item], "pl");
    expect(rows.map((r) => r.rowKey)).toEqual(["e-a", "pending:op-s2", "e-b"]);
  });

  it("une entrée d'avant (sans `imported`) reste « en attente »", () => {
    const item = pendingItem("x", { kind: "playlistAdd", playlistId: "pl", position: 0 });
    expect(mergePlaylist([], [item], "pl")[0]?.track.availability).toBe("pending");
  });
});

describe("playlistTrackTotal", () => {
  const add = (playlistId: string, operationId: string) => ({ kind: "playlistAdd", playlistId, operationId }) as unknown as PendingMusicItem;
  const like = { kind: "like", operationId: "l" } as unknown as PendingMusicItem;

  it("compte les ajouts en attente de CETTE playlist en plus des titres de Jellyfin", () => {
    expect(playlistTrackTotal(154, [add("p1", "a"), add("p1", "b"), add("p2", "c"), like], "p1")).toBe(156);
  });

  it("sans attente, le total est celui de Jellyfin", () => {
    expect(playlistTrackTotal(154, [], "p1")).toBe(154);
  });
});
