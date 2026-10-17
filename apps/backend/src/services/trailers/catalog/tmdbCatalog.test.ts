import { beforeEach, describe, expect, it, vi } from "vitest";

const rows = new Map<string, { payload: unknown; generatedAt: Date; expiresAt: Date }>();
vi.mock("../../globalCacheStore", () => ({
  readGlobalCache: async (key: string) => rows.get(key) ?? null,
  writeGlobalCache: async (key: string, payload: unknown, ttlMs: number) =>
    void rows.set(key, { payload, generatedAt: new Date(), expiresAt: new Date(Date.now() + ttlMs) }),
}));

const tmdbFetch = vi.fn();
vi.mock("../../tmdb/client", () => {
  class TmdbError extends Error {
    constructor(message: string, readonly status: number) {
      super(message);
    }
  }
  return { TmdbError, tmdbFetch: (...args: unknown[]) => tmdbFetch(...args) };
});

import { TmdbError } from "../../tmdb/client";
import { resetCatalogMemory } from "./catalogMemory";
import { fetchTmdbSeasonVideos, fetchTmdbTitle, tmdbTitleOf, videoLanguages } from "./tmdbCatalog";

const DAY = 86_400_000;

beforeEach(() => {
  rows.clear();
  resetCatalogMemory();
  tmdbFetch.mockReset();
});

const rickDto = {
  name: "Rick et Morty",
  original_name: "Rick and Morty",
  original_language: "en",
  first_air_date: "2013-12-02",
  last_air_date: "2025-07-27",
  in_production: true,
  origin_country: ["US"],
  seasons: [{ season_number: 0, air_date: null }, { season_number: 6, air_date: "2022-09-04" }],
  videos: { results: [{ key: "abcdefghijk", site: "YouTube", type: "Trailer", name: "Season 1 Promos", iso_639_1: "en" }] },
  alternative_titles: { results: [{ iso_3166_1: "FR", title: "Rick & Morty" }, { iso_3166_1: "DE", title: "Rick und Morty" }] },
};

describe("TMDB du catalogue › le titre", () => {
  it("les noms (langue du serveur, original, alternatifs de ses pays), les dates, les pays, les saisons", () => {
    expect(tmdbTitleOf("tv", rickDto, "fr-FR")).toEqual({
      kind: "tv",
      names: ["Rick et Morty", "Rick and Morty", "Rick & Morty"],
      originalLanguage: "en",
      releaseDate: "2013-12-02",
      lastAirDate: "2025-07-27",
      ongoing: true,
      countries: ["US"],
      seasons: [{ season: 0, airDate: null }, { season: 6, airDate: "2022-09-04" }],
    });
    // Un serveur anglais ne retient pas les titres français.
    expect(tmdbTitleOf("tv", rickDto, "en").names).toEqual(["Rick et Morty", "Rick and Morty"]);
  });

  it("les langues demandées : celle du serveur, l'anglais, sans langue", () => {
    expect(videoLanguages("fr-FR")).toBe("fr,en,null");
    expect(videoLanguages("en")).toBe("en,null");
    expect(videoLanguages(null)).toBe("en,null");
  });

  it("une lecture par titre et par langue, partagée, gardée 7 jours", async () => {
    tmdbFetch.mockResolvedValueOnce(rickDto);
    const [a, b] = await Promise.all([fetchTmdbTitle(60625, "tv", "fr-FR"), fetchTmdbTitle(60625, "tv", "fr-FR")]);
    expect(tmdbFetch).toHaveBeenCalledTimes(1);
    expect(tmdbFetch.mock.calls[0]).toEqual([
      "/tv/60625",
      { append_to_response: "videos,alternative_titles", include_video_language: "fr,en,null", language: "fr-FR" },
      { priority: "interactive" },
    ]);
    expect(a).toEqual(b);
    expect(a?.videos.map((v) => v.key)).toEqual(["abcdefghijk"]);
    const stored = rows.get("trailers:tmdb:tv:60625:fr-FR")?.payload as { validUntil: number };
    expect(stored.validUntil - Date.now()).toBeGreaterThan(7 * DAY - 5_000);
    await fetchTmdbTitle(60625, "tv", "fr-FR");
    expect(tmdbFetch).toHaveBeenCalledTimes(1);
  });

  it("rien dans la langue du serveur ni en anglais : la langue originale ensuite", async () => {
    tmdbFetch
      .mockResolvedValueOnce({ title: "Perfect Blue", original_language: "ja", release_date: "1998-02-28", videos: { results: [] } })
      .mockResolvedValueOnce({ results: [{ key: "jjjjjjjjjjj", site: "YouTube", type: "Trailer", iso_639_1: "ja" }] });
    const title = await fetchTmdbTitle(10494, "movie", "fr-FR");
    expect(tmdbFetch.mock.calls[1][0]).toBe("/movie/10494/videos");
    expect(title?.videos.map((v) => v.lang)).toEqual(["ja"]);
  });

  it("un titre inconnu de TMDB n'a rien (gardé 1 jour) ; TMDB muet : null, rien en mémoire", async () => {
    tmdbFetch.mockRejectedValueOnce(new TmdbError("absent", 404));
    expect((await fetchTmdbTitle(1, "movie", "fr"))?.videos).toEqual([]);
    const stored = rows.get("trailers:tmdb:movie:1:fr")?.payload as { validUntil: number };
    expect(stored.validUntil - Date.now()).toBeLessThanOrEqual(DAY);
    tmdbFetch.mockRejectedValueOnce(new Error("réseau"));
    expect(await fetchTmdbTitle(2, "movie", "fr")).toBeNull();
    expect(rows.has("trailers:tmdb:movie:2:fr")).toBe(false);
  });
});

describe("TMDB du catalogue › une saison", () => {
  it("lit /tv/{id}/season/{n}/videos dans les langues du serveur, et la garde", async () => {
    tmdbFetch.mockResolvedValueOnce({ results: [{ key: "s6aaaaaaaaa", site: "YouTube", type: "Trailer", name: "Bande-annonce VF", iso_639_1: "fr" }] });
    const videos = await fetchTmdbSeasonVideos(60625, 6, "fr-FR", "background");
    expect(tmdbFetch.mock.calls[0]).toEqual(["/tv/60625/season/6/videos", { include_video_language: "fr,en,null" }, { priority: "background" }]);
    expect(videos?.map((v) => v.key)).toEqual(["s6aaaaaaaaa"]);
    expect(rows.has("trailers:tmdb:tv:60625:s6:fr-FR")).toBe(true);
  });

  it("une lecture de fond rejointe par un survol est redemandée en interactif (le client TMDB la fait passer devant)", async () => {
    const answers: Array<(value: unknown) => void> = [];
    tmdbFetch.mockImplementation(() => new Promise((resolve) => answers.push(resolve)));
    const background = fetchTmdbSeasonVideos(60625, 5, "fr", "background");
    await vi.waitFor(() => expect(tmdbFetch).toHaveBeenCalledTimes(1));
    // Une autre demande de fond rejoint simplement celle qui court.
    void fetchTmdbSeasonVideos(60625, 5, "fr", "background");
    const waiting = fetchTmdbSeasonVideos(60625, 5, "fr");
    await vi.waitFor(() => expect(tmdbFetch).toHaveBeenCalledTimes(2));
    expect(tmdbFetch.mock.calls.map((call) => call[2])).toEqual([{ priority: "background" }, { priority: "interactive" }]);
    const result = { results: [{ key: "s5aaaaaaaaa", site: "YouTube", type: "Trailer", iso_639_1: "fr" }] };
    for (const answer of answers) answer(result);
    expect((await waiting)?.map((v) => v.key)).toEqual(["s5aaaaaaaaa"]);
    expect((await background)?.map((v) => v.key)).toEqual(["s5aaaaaaaaa"]);
  });

  it("une valeur échue sert tout de suite, et se refait en fond", async () => {
    rows.set("trailers:tmdb:tv:60625:s3:fr", {
      payload: { value: [{ key: "oldoldoldol", url: "u" }], validUntil: Date.now() - 1 },
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + DAY),
    });
    tmdbFetch.mockResolvedValueOnce({ results: [] });
    expect((await fetchTmdbSeasonVideos(60625, 3, "fr"))?.map((v) => v.key)).toEqual(["oldoldoldol"]);
    await vi.waitFor(() => expect(tmdbFetch).toHaveBeenCalledWith("/tv/60625/season/3/videos", expect.anything(), { priority: "background" }));
  });
});
