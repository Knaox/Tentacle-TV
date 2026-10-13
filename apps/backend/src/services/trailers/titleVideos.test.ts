/**
 * Les vidéos d'un titre pour choisir une bande-annonce : TMDB par la clé du
 * serveur (la langue demandée, l'anglais, sans langue ; la langue originale
 * s'il n'y a rien), sinon Jellyseerr. TMDB et Jellyseerr sont factices.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { tmdbFetch, state } = vi.hoisted(() => ({
  tmdbFetch: vi.fn(),
  state: { tmdbKey: true, seerr: null as null | { url: string; apiKey: string } },
}));
vi.mock("../tmdb/client", async (original) => ({
  ...(await original<typeof import("../tmdb/client")>()),
  tmdbFetch,
  tmdbConfigured: () => state.tmdbKey,
}));
vi.mock("../seerConfig", () => ({ getSeerrConfig: () => state.seerr }));

import { TmdbError } from "../tmdb/client";
import { fetchSeerrVideos, fetchTitleVideos, fetchTmdbVideos, orderTmdbVideos, type TmdbVideoDto } from "./titleVideos";

const video = (key: string, over: Partial<TmdbVideoDto> = {}): TmdbVideoDto => ({
  key, name: key, type: "Trailer", site: "YouTube", iso_639_1: "fr", official: true, size: 1080, published_at: "2024-01-01T00:00:00.000Z", ...over,
});

beforeEach(() => {
  tmdbFetch.mockReset();
  state.tmdbKey = true;
  state.seerr = null;
});
afterEach(() => vi.unstubAllGlobals());

describe("ordre des vidéos TMDB (à langue et type égaux)", () => {
  it("une VF avant une VOST, l'officielle, la plus haute définition, la plus récente ; YouTube seulement", () => {
    const ordered = orderTmdbVideos([
      video("vostfr-1080", { name: "Bande-annonce VOST" }),
      video("vf-480", { size: 480 }),
      video("vf-1080-old", { published_at: "2021-01-01T00:00:00.000Z" }),
      video("vf-1080-new", { published_at: "2023-06-01T00:00:00.000Z" }),
      video("fan", { official: false, size: 2160 }),
      video("vimeo", { site: "Vimeo" }),
      video("", {}),
    ]);
    expect(ordered.map((v) => v.key)).toEqual(["vf-1080-new", "vf-1080-old", "vf-480", "fan", "vostfr-1080"]);
    expect(ordered[0]).toEqual({
      key: "vf-1080-new", name: "vf-1080-new", type: "Trailer", site: "YouTube", lang: "fr", url: "https://www.youtube.com/watch?v=vf-1080-new",
    });
  });
});

describe("vidéos TMDB d'un titre", () => {
  it("demande la langue de l'interface, l'anglais et les vidéos sans langue", async () => {
    tmdbFetch.mockResolvedValueOnce({ original_language: "en", videos: { results: [video("a")] } });
    expect((await fetchTmdbVideos(438631, "movie", "fr"))?.map((v) => v.key)).toEqual(["a"]);
    expect(tmdbFetch).toHaveBeenCalledWith("/movie/438631", { append_to_response: "videos", include_video_language: "fr,en,null" });
    tmdbFetch.mockResolvedValueOnce({ original_language: "en", videos: { results: [] } });
    await fetchTmdbVideos(1396, "tv", undefined);
    expect(tmdbFetch).toHaveBeenLastCalledWith("/tv/1396", { append_to_response: "videos", include_video_language: "en,null" });
  });

  it("sans bande-annonce ni teaser, celles de la langue originale viennent après", async () => {
    tmdbFetch
      .mockResolvedValueOnce({ original_language: "ja", videos: { results: [video("clip-fr", { type: "Clip" })] } })
      .mockResolvedValueOnce({ results: [video("ja-trailer", { iso_639_1: "ja" })] });
    const videos = await fetchTmdbVideos(372058, "movie", "fr");
    expect(videos?.map((v) => v.key)).toEqual(["clip-fr", "ja-trailer"]);
    expect(tmdbFetch).toHaveBeenLastCalledWith("/movie/372058/videos", { include_video_language: "ja" });
  });

  it("un titre inconnu de TMDB n'a pas de vidéos ; une panne n'est pas une absence", async () => {
    tmdbFetch.mockRejectedValueOnce(new TmdbError("TMDB 404", 404));
    expect(await fetchTmdbVideos(1, "movie", "fr")).toEqual([]);
    tmdbFetch.mockRejectedValueOnce(new TmdbError("TMDB 503", 503));
    expect(await fetchTmdbVideos(1, "movie", "fr")).toBeNull();
  });
});

describe("source des vidéos", () => {
  it("TMDB d'abord ; muet, Jellyseerr ; sans aucune source, une liste vide complète", async () => {
    tmdbFetch.mockResolvedValueOnce({ original_language: "en", videos: { results: [video("tmdb")] } });
    expect(await fetchTitleVideos(10, "movie", "fr")).toEqual({ videos: [expect.objectContaining({ key: "tmdb" })], complete: true });

    tmdbFetch.mockRejectedValueOnce(new Error("réseau"));
    state.seerr = { url: "http://seerr.test", apiKey: "k" };
    const seerrFetch = vi.fn(async () => new Response(JSON.stringify({
      relatedVideos: [{ key: "seerr", name: "Bande-annonce", type: "Trailer", site: "YouTube", iso_639_1: "fr" }, { key: "vimeo", site: "Vimeo" }],
    })));
    vi.stubGlobal("fetch", seerrFetch);
    expect((await fetchTitleVideos(10, "movie", "fr")).videos.map((v) => v.key)).toEqual(["seerr"]);
    expect(String((seerrFetch.mock.calls[0] as unknown[])[0])).toBe("http://seerr.test/api/v1/movie/10");

    state.seerr = null;
    tmdbFetch.mockRejectedValueOnce(new Error("réseau"));
    expect(await fetchTitleVideos(10, "movie", "fr")).toEqual({ videos: [], complete: false });
    state.tmdbKey = false;
    expect(await fetchTitleVideos(10, "movie", "fr")).toEqual({ videos: [], complete: true });
  });

  it("Jellyseerr absent ou en erreur : rien", async () => {
    expect(await fetchSeerrVideos(10, "tv")).toBeNull();
    state.seerr = { url: "http://seerr.test", apiKey: "k" };
    vi.stubGlobal("fetch", vi.fn(async () => new Response("non", { status: 500 })));
    expect(await fetchSeerrVideos(10, "tv")).toBeNull();
  });
});
