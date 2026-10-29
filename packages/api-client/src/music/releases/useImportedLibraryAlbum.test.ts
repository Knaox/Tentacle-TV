import { describe, expect, it, vi } from "vitest";
import type { MusicAlbum, MusicMatchRequest } from "@tentacle-tv/shared/music";

const h = vi.hoisted(() => ({ requests: [] as MusicMatchRequest[] }));
vi.mock("../musicApi", () => ({
  musicApi: {
    match: async (request: MusicMatchRequest) => {
      h.requests.push(request);
      return { tracks: [], albums: [{ ref: "ext:sillon:own:al:1", album: { jellyfinId: "jf-album" }, coverage: "full", tracks: [] }] };
    },
  },
}));
const { findImportedLibraryAlbum } = await import("./useImportedLibraryAlbum");

const album = {
  key: "ext:sillon:own:al:1",
  jellyfinId: null,
  external: { pluginId: "sillon", id: "own:al:1" },
  title: "TRUTH LIES IN BETWEEN",
  artists: [{ name: "Bastian Baker", mbid: null, jellyfinId: null }],
  mbids: { release: null, releaseGroup: null },
  kind: "album",
  trackCount: 11,
  imported: true,
  tracks: [{ key: "jf:t1", jellyfinId: "t1", availability: "library" }],
} as unknown as MusicAlbum;

describe("l'album de la bibliothèque d'une sortie importée", () => {
  it("se demande par l'album seul (titre, artistes, 11 titres), jamais avec une liste de titres vide", async () => {
    expect(await findImportedLibraryAlbum(album)).toBe("jf-album");
    const query = h.requests[0]!.albums![0]!;
    expect(query).toMatchObject({ ref: album.key, title: "TRUTH LIES IN BETWEEN", trackCount: 11 });
    expect(query.tracks).toBeUndefined();
  });
});
