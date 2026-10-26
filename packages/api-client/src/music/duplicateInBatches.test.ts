import { describe, expect, it } from "vitest";
import type { MusicPlaylistDetail } from "@tentacle-tv/shared/music";
import { duplicateInBatches } from "./useMusicPlaylists";

const detail = (id: string): MusicPlaylistDetail => ({ jellyfinId: id, name: "Copie", trackCount: 0, durationMs: null, artworkUrl: null, editable: true, entries: [] });

describe("dupliquer une playlist", () => {
  it("1 200 titres : une création de 500, puis deux ajouts à la fin, dans l'ordre, sans doublon", async () => {
    const calls: string[] = [];
    const ids = Array.from({ length: 1200 }, (_, i) => `id${i}`);
    const api = {
      createPlaylist: async (name: string, itemIds: string[]) => {
        calls.push(`create ${name} ${itemIds.length} ${itemIds[0]}`);
        return detail("new");
      },
      insertEntries: async (id: string, itemIds: string[], position?: number) => {
        calls.push(`insert ${id} ${itemIds.length} ${itemIds[0]} ${position ?? "fin"}`);
        return detail(id);
      },
    };
    await duplicateInBatches(api, "Copie", [...ids, "id3"]);
    expect(calls).toEqual(["create Copie 500 id0", "insert new 500 id500 fin", "insert new 200 id1000 fin"]);
  });

  it("une petite playlist : une seule création", async () => {
    const calls: string[] = [];
    await duplicateInBatches({ createPlaylist: async (n, i) => (calls.push(`${n}:${i.length}`), detail("x")), insertEntries: async () => detail("x") }, "Copie", ["a", "b"]);
    expect(calls).toEqual(["Copie:2"]);
  });
});
