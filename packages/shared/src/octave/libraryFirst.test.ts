import { describe, expect, it } from "vitest";
import type { MusicTrack, PendingMusicItem } from "../music";
import { externalTrack, libraryTrack } from "./fixtures";
import { libraryFirst } from "./libraryFirst";
import { mergeLiked, mergePlaylist } from "./pendingMerge";

// Le cas de Damien (26/10) : une playlist montre « En file : 3 demandes avant » pour un titre qui est DÉJÀ dans la
// bibliothèque (arrivé par un autre album) — l'attente n'est pas encore une entrée de CETTE playlist, et ni son
// MBID ni sa clé ne la rapprochaient du titre de la bibliothèque. La correspondance du cœur, elle, le sait.
function waitingAdd(id: string, overrides: Partial<PendingMusicItem> = {}): PendingMusicItem {
  return {
    operationId: `op-${id}`, externalId: id, kind: "playlistAdd", playlistId: "pl", position: 0,
    track: externalTrack("sillon", id), state: "pending", createdAt: 1, note: "En file : 3 demandes avant.", ...overrides,
  };
}
const ownedBy = (pairs: Array<[string, MusicTrack]>): ReadonlyMap<string, MusicTrack> => new Map(pairs);

describe("libraryFirst — Jellyfin fait foi", () => {
  it("une attente dont le titre est dans la bibliothèque se montre comme lui : marque, lecture, aucune note", () => {
    const item = waitingAdd("r1");
    const own = libraryTrack("x");
    const rows = libraryFirst(mergePlaylist([], [item], "pl"), ownedBy([[item.track.key, own]]));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.track).toBe(own);
    expect(rows[0]?.track.availability).toBe("library");
    expect(rows[0]?.pending).toEqual({ operationId: "op-r1", failed: false, note: null });
    expect(rows[0]?.rowKey).toBe("pending:op-r1");
  });

  it("même une demande ÉCHOUÉE : le titre est là, il n'y a rien d'échoué à montrer", () => {
    const item = waitingAdd("r1", { state: "failed", note: "Lidarr ne l'a pas trouvé." });
    const rows = libraryFirst(mergePlaylist([], [item], "pl"), ownedBy([[item.track.key, libraryTrack("x")]]));
    expect(rows[0]?.pending?.failed).toBe(false);
    expect(rows[0]?.pending?.note).toBeNull();
  });

  it("déjà une rangée réelle de la liste (un favori) : l'attente s'efface, jamais deux fois le même titre", () => {
    const item = waitingAdd("r1", { kind: "like", playlistId: null });
    const own = libraryTrack("x");
    const rows = libraryFirst(mergeLiked([own], [item]), ownedBy([[item.track.key, own]]));
    expect(rows.map((r) => r.rowKey)).toEqual(["jf:x"]);
  });

  it("rien dans la bibliothèque : les mêmes rangées, la même référence ; une attente inconnue garde sa note", () => {
    const rows = mergePlaylist([], [waitingAdd("r1")], "pl");
    expect(libraryFirst(rows, ownedBy([]))).toBe(rows);
    const other = libraryFirst(rows, ownedBy([["autre", libraryTrack("y")]]));
    expect(other).toBe(rows);
    expect(other[0]?.pending?.note).toBe("En file : 3 demandes avant.");
  });
});
