/** « Sur cet appareil » montre EXACTEMENT la jaquette en ligne, d'après ce que l'appareil a gardé. */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { mosaicCandidates, pickMosaic, type MusicTrack } from "@tentacle-tv/shared/music";
import type { KeptCover } from "./keptCovers/coverPlan";

const NOW = Date.now();
const h = vi.hoisted(() => ({ covers: new Map<string, unknown>(), copies: new Map<string, string>() }));
vi.mock("@tentacle-tv/api-client", () => ({ useJellyfinClient: () => ({ getToken: () => null, useCredentials: true }) }));
vi.mock("../../../lib/backendBase", () => ({ getBackendBase: () => "" }));
vi.mock("../../../downloads/localFiles", () => ({ useDownloadsRootReady: () => true, localResourceUrl: (rel: string) => `tentacle://local/${rel}` }));
vi.mock("./keptCovers/useKeptCoverKeeper", () => ({ useKeptCoverState: () => ({ covers: h.covers, copies: h.copies }) }));

const { KeptCollectionArtwork } = await import("./KeptCollectionArtwork");

function track(album: string): MusicTrack {
  return {
    key: `jf:${album}1`, jellyfinId: `${album}1`, external: null, title: album, artists: [{ name: album, mbid: null, jellyfinId: `ar${album}` }],
    album: { title: album, mbid: null, jellyfinId: `al${album}` }, durationMs: 1, trackNumber: 1, discNumber: 1, year: null,
    artworkUrl: `/api/music/artwork/${album}1?tag=x`, mbids: { recording: null, release: null, releaseGroup: null, artists: [] }, availability: "library", format: null, favorite: false,
  };
}
const albums = Array.from({ length: 9 }, (_, k) => track(`a${k}`));
const collection = { key: "playlist:jf:p1", kind: "playlist" as const, title: "New", subtitle: null, artworkUrl: null, tracks: albums, keys: albums.map((t) => t.key) };
const srcs = (html: string) => [...html.matchAll(/<img src="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, "&"));
const render = (offline: boolean) => renderToStaticMarkup(<KeptCollectionArtwork collection={collection} kept={[]} offline={offline} />);

describe("KeptCollectionArtwork", () => {
  it("hors ligne, la mosaïque du jour en ligne (mêmes albums), par les copies gardées", () => {
    const candidates = mosaicCandidates(albums);
    const saved: KeptCover = { playlistId: "p1", artworkUrl: "/api/music/artwork/p1?tag=collage", cover: { handPlaced: false, candidates }, savedAt: 0 };
    h.covers = new Map([["p1", saved]]);
    h.copies = new Map(albums.map((a) => [a.artworkUrl!, `blob:copy-${a.title}`]));
    const online = pickMosaic(candidates, "p1", NOW);
    expect(srcs(render(true))).toEqual(online.map((url) => h.copies.get(url)));
  });

  it("hors ligne, l'image posée à la main, telle quelle", () => {
    h.covers = new Map([["p1", { playlistId: "p1", artworkUrl: "/api/music/artwork/p1?tag=mine", cover: { handPlaced: true, candidates: mosaicCandidates(albums) }, savedAt: 0 }]]);
    h.copies = new Map([["/api/music/artwork/p1?tag=mine", "blob:mine"]]);
    expect(srcs(render(true))).toEqual(["blob:mine"]);
  });

  it("hors ligne, une image pas encore copiée : la teinte du repli dans sa case, jamais une adresse qui ne charge pas", () => {
    h.copies = new Map();
    const html = render(true);
    expect(srcs(html)).toEqual([]);
    expect(html).toContain("octave-art-fallback");
  });
});
