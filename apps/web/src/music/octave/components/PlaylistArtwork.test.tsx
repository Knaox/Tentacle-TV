import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@tentacle-tv/api-client", () => ({ useJellyfinClient: () => ({ getToken: () => null, useCredentials: true }) }));
vi.mock("../../../lib/backendBase", () => ({ getBackendBase: () => "" }));

const { PlaylistArtwork, playlistCoverUrls } = await import("./PlaylistArtwork");

const urls = (n: number) => Array.from({ length: n }, (_, k) => `/api/music/artwork/al${k}?tag=t`);
const images = (html: string) => (html.match(/<img /g) ?? []).length;

describe("PlaylistArtwork", () => {
  it("quatre pochettes : une grille 2 × 2 de quatre images, arrondie par le cadre seul", () => {
    const html = renderToStaticMarkup(<PlaylistArtwork urls={urls(4)} label="New" radius="art" />);
    expect(images(html)).toBe(4);
    expect(html.match(/border-radius:0/g)).toHaveLength(4);
    expect(html).toContain("aria-hidden");
  });

  it("une pochette : une seule image ; aucune : le repli teinté, jamais une case vide", () => {
    expect(images(renderToStaticMarkup(<PlaylistArtwork urls={urls(1)} label="New" />))).toBe(1);
    const none = renderToStaticMarkup(<PlaylistArtwork urls={[]} label="New" />);
    expect(images(none)).toBe(0);
    expect(none).toContain("octave-art-fallback");
  });

  it("la barre latérale demande des vignettes de 128 px par case", () => {
    expect(renderToStaticMarkup(<PlaylistArtwork urls={urls(4)} label="New" thumb />).match(/size=128/g)).toHaveLength(4);
  });
});

describe("playlistCoverUrls", () => {
  it("la mosaïque du cœur d'abord, sinon l'image de Jellyfin (posée à la main, serveur d'avant), sinon rien", () => {
    expect(playlistCoverUrls({ mosaic: urls(4), artworkUrl: "/collage" })).toEqual(urls(4));
    expect(playlistCoverUrls({ artworkUrl: "/mine" })).toEqual(["/mine"]);
    expect(playlistCoverUrls({ mosaic: [], artworkUrl: null })).toEqual([]);
  });
});
