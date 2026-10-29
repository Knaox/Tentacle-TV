import { describe, expect, it } from "vitest";
import { playlistCoverLayout, playlistCoverUrls } from "./playlistCover";

const urls = (n: number) => Array.from({ length: n }, (_, i) => `/a${i}`);

describe("playlistCoverUrls", () => {
  it("la mosaïque du jour d'abord, sinon l'image de Jellyfin, sinon rien", () => {
    expect(playlistCoverUrls({ mosaic: urls(4), artworkUrl: "/collage" })).toEqual(urls(4));
    expect(playlistCoverUrls({ mosaic: [], artworkUrl: "/mine" })).toEqual(["/mine"]);
    expect(playlistCoverUrls({ artworkUrl: "/mine" })).toEqual(["/mine"]);
    expect(playlistCoverUrls({ mosaic: [], artworkUrl: null })).toEqual([]);
  });
});

describe("playlistCoverLayout", () => {
  it("quatre images ou plus : une grille des quatre premières", () => {
    expect(playlistCoverLayout(urls(5))).toEqual({ kind: "grid", cells: ["/a0", "/a1", "/a2", "/a3"] });
  });
  it("moins de quatre : la première seule, jamais une case vide pour remplir", () => {
    expect(playlistCoverLayout(urls(3))).toEqual({ kind: "single", url: "/a0" });
    expect(playlistCoverLayout(urls(1))).toEqual({ kind: "single", url: "/a0" });
    expect(playlistCoverLayout([])).toEqual({ kind: "single", url: null });
  });
  it("une case absente (hors ligne) reste une case de la grille", () => {
    expect(playlistCoverLayout(["/a", null, "/c", "/d"])).toEqual({ kind: "grid", cells: ["/a", null, "/c", "/d"] });
  });
});
