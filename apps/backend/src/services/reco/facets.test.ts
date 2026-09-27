import { describe, expect, it } from "vitest";
import {
  ANIME_UNIVERSE_KEY,
  TMDB_KEYWORD_ANIME,
  decadeOf,
  facetsFromJellyfin,
  facetsFromTmdb,
  hasAnimeUniverse,
  isAnimeCoarse,
  isAnimeJellyfin,
  isAnimeTmdb,
  mergeUniverseFacets,
  runtimeBucket,
} from "./facets";
import { DEFAULT_FACET_WEIGHTS, NETWORKS_MAX, STUDIOS_MAX } from "./facetWeights";
import type { TitleMeta } from "../tmdb/metaCache";

const META: TitleMeta = {
  mediaType: "movie",
  tmdbId: 603,
  title: "The Matrix",
  genres: [{ id: 28, name: "Action" }, { id: 878, name: "Science Fiction" }],
  keywords: [{ id: 310, name: "artificial intelligence" }, { id: 4565, name: "dystopia" }],
  directors: [{ id: 9339, name: "Lilly Wachowski" }, { id: 9340, name: "Lana Wachowski" }],
  topCast: [
    { id: 6384, name: "Keanu Reeves" },
    { id: 2975, name: "Laurence Fishburne" },
    { id: 530, name: "Carrie-Anne Moss" },
    { id: 1331, name: "Hugo Weaving" },
    { id: 3799, name: "Joe Pantoliano" },
  ],
  studios: [{ id: 79, name: "Village Roadshow Pictures" }],
  networks: [],
  year: 1999,
  originalLanguage: "en",
  originCountry: ["US"],
  runtimeMinutes: 136,
  popularity: 80,
  voteAverage: 8.2,
  voteCount: 24000,
  posterPath: "/matrix.jpg",
  backdropPath: "/matrix-backdrop.jpg",
  providers: null,
};

describe("facettes TMDB", () => {
  const entries = facetsFromTmdb(META);
  const byKey = new Map(entries.map((e) => [e.key, e.mult]));

  it("chaque famille porte son poids : l'auteur d'un film pèse plus qu'un acteur", () => {
    expect(byKey.get("director:9339")).toBe(DEFAULT_FACET_WEIGHTS.director);
    expect(byKey.get("actor:6384")).toBe(DEFAULT_FACET_WEIGHTS.actor);
    expect(DEFAULT_FACET_WEIGHTS.director).toBeGreaterThan(DEFAULT_FACET_WEIGHTS.actor);
  });

  it("genres, keywords, studio, décennie, langue et durée sont présents", () => {
    for (const key of ["genre:28", "kw:310", "kw:4565", "studio:79", "decade:1990", "lang:en", "runtime:long"]) {
      expect(byKey.has(key), key).toBe(true);
    }
  });

  it("les mots-clés de production (générique, suite, remake…) ne font pas facette", () => {
    const keys = facetsFromTmdb({
      ...META,
      keywords: [
        { id: 179431, name: "duringcreditsstinger" },
        { id: 9663, name: "sequel" },
        { id: 310, name: "artificial intelligence" },
      ],
    }).map((e) => e.key);
    expect(keys).toContain("kw:310");
    expect(keys).not.toContain("kw:179431");
    expect(keys).not.toContain("kw:9663");
  });

  it("studios et chaînes plafonnés : un comité de production ne relie pas tout", () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `S${i}` }));
    const keys = facetsFromTmdb({ ...META, mediaType: "tv", studios: many(8), networks: many(6) }).map((e) => e.key);
    expect(keys.filter((k) => k.startsWith("studio:"))).toHaveLength(STUDIOS_MAX);
    expect(keys.filter((k) => k.startsWith("network:"))).toHaveLength(NETWORKS_MAX);
  });

  it("une série n'a pas de facette de durée (la durée d'un épisode ne dit rien)", () => {
    const keys = facetsFromTmdb({ ...META, mediaType: "tv", runtimeMinutes: 24 }).map((e) => e.key);
    expect(keys.some((k) => k.startsWith("runtime:"))).toBe(false);
    // Le créateur d'une série garde la clé director:, à son propre poids.
    const creator = facetsFromTmdb({ ...META, mediaType: "tv" }).find((e) => e.key === "director:9339");
    expect(creator?.mult).toBe(DEFAULT_FACET_WEIGHTS.creator);
  });

  it("une animation : les acteurs sont des voix, elles pèsent moins", () => {
    const animated = facetsFromTmdb({ ...META, genres: [{ id: 16, name: "Animation" }] });
    expect(animated.find((e) => e.key === "actor:6384")?.mult).toBe(DEFAULT_FACET_WEIGHTS.voiceActor);
  });
});

describe("buckets et décennies", () => {
  it("buckets de durée aux bornes de la spec (< 90, 90-120, 120-150, > 150)", () => {
    expect(runtimeBucket(85)).toBe("short");
    expect(runtimeBucket(90)).toBe("standard");
    expect(runtimeBucket(120)).toBe("standard");
    expect(runtimeBucket(121)).toBe("long");
    expect(runtimeBucket(150)).toBe("long");
    expect(runtimeBucket(151)).toBe("epic");
  });

  it("décennie", () => {
    expect(decadeOf(1994)).toBe(1990);
    expect(decadeOf(2000)).toBe(2000);
  });
});

describe("facettes de repli Jellyfin", () => {
  it("espaces de clés distincts (genre-name:, studio-name:) et slugs stables", () => {
    const entries = facetsFromJellyfin({
      Genres: ["Science Fiction", "Drame"],
      Studios: [{ Name: "Warner Bros. Pictures" }],
      ProductionYear: 1999,
      RunTimeTicks: 136 * 600_000_000,
    });
    const keys = entries.map((e) => e.key);
    expect(keys).toContain("genre-name:science-fiction");
    expect(keys).toContain("studio-name:warner-bros.-pictures");
    expect(keys).toContain("decade:1990");
    expect(keys).toContain("runtime:long");
    // Jamais l'espace des IDs TMDB.
    expect(keys.every((k) => !k.startsWith("genre:") && !k.startsWith("studio:"))).toBe(true);
  });

  it("une fiche Series n'a pas de facette de durée", () => {
    const series = facetsFromJellyfin({ Type: "Series", RunTimeTicks: 24 * 600_000_000, ProductionYear: 2019 });
    expect(series.some((e) => e.key.startsWith("runtime:"))).toBe(false);
    const byType = facetsFromJellyfin({ mediaType: "tv", RunTimeTicks: 24 * 600_000_000 });
    expect(byType.some((e) => e.key.startsWith("runtime:"))).toBe(false);
  });
});

describe("univers animé", () => {
  const anime = (over: Partial<TitleMeta>): TitleMeta => ({
    ...META,
    genres: [{ id: 16, name: "Animation" }, { id: 10759, name: "Action & Adventure" }],
    keywords: [],
    originalLanguage: "ja",
    originCountry: ["JP"],
    ...over,
  });
  const keysOf = (entries: Array<{ key: string }>) => entries.map((e) => e.key);

  it("une fiche TMDB : Animation ET japonais (langue, pays ou mot-clé « anime »)", () => {
    expect(isAnimeTmdb(anime({}))).toBe(true);
    // Animation occidentale : jamais un animé.
    expect(isAnimeTmdb(anime({ originalLanguage: "en", originCountry: ["US"] }))).toBe(false);
    // Drama japonais en prises de vues réelles : pas d'Animation, pas d'animé.
    expect(isAnimeTmdb(anime({ genres: [{ id: 18, name: "Drama" }] }))).toBe(false);
    // Coproduction en anglais : le mot-clé « anime » ou le pays suffisent.
    const coprod = { originalLanguage: "en", originCountry: [] as string[] };
    expect(isAnimeTmdb(anime({ ...coprod, keywords: [{ id: TMDB_KEYWORD_ANIME, name: "anime" }] }))).toBe(true);
    expect(isAnimeTmdb(anime({ originalLanguage: "en", originCountry: ["JP"] }))).toBe(true);
  });

  it("facetsFromTmdb pose universe:anime sur un animé, pas sur South Park", () => {
    expect(keysOf(facetsFromTmdb(anime({})))).toContain(ANIME_UNIVERSE_KEY);
    const western = anime({ originalLanguage: "en", originCountry: ["US"] });
    expect(keysOf(facetsFromTmdb(western))).not.toContain(ANIME_UNIVERSE_KEY);
  });

  it("une liste TMDB (facettes grossières) : genre 16 + langue ou pays", () => {
    expect(isAnimeCoarse([16, 10759], "ja")).toBe(true);
    expect(isAnimeCoarse([16], "en", ["JP"])).toBe(true);
    expect(isAnimeCoarse([16], "en", ["US"])).toBe(false);
    expect(isAnimeCoarse([18], "ja")).toBe(false);
  });

  it("Jellyfin : le genre « Anime » ou un id AniDB/AniList — jamais « Animation » seul", () => {
    expect(isAnimeJellyfin({ Genres: ["Anime", "Action"] })).toBe(true);
    expect(isAnimeJellyfin({ Genres: ["Animation"] })).toBe(false);
    expect(isAnimeJellyfin({ Genres: ["Animation"], ProviderIds: { AniDB: "1" } })).toBe(true);
    expect(isAnimeJellyfin({ ProviderIds: { anilist: "5" } })).toBe(true);
    const keys = keysOf(facetsFromJellyfin({ Genres: ["Anime"] }));
    expect(keys).toContain(ANIME_UNIVERSE_KEY);
    expect(keys).toContain("genre-name:anime");
  });

  it("l'enrichissement TMDB ne perd pas l'univers posé avant lui", () => {
    const prev = [{ key: "genre:16", mult: 1 }, { key: ANIME_UNIVERSE_KEY, mult: 1 }];
    const next = [{ key: "genre:16", mult: 1 }, { key: "kw:1", mult: 1 }];
    const merged = mergeUniverseFacets(prev, next);
    expect(keysOf(merged)).toEqual(["genre:16", "kw:1", ANIME_UNIVERSE_KEY]);
    expect(hasAnimeUniverse(keysOf(merged))).toBe(true);
    // Déjà présent dans l'enrichi : pas de doublon.
    const already = mergeUniverseFacets(prev, [...next, { key: ANIME_UNIVERSE_KEY, mult: 1 }]);
    expect(already.filter((f) => f.key === ANIME_UNIVERSE_KEY)).toHaveLength(1);
    expect(hasAnimeUniverse(["genre:16"])).toBe(false);
  });
});
