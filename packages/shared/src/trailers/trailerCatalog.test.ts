import { describe, expect, it } from "vitest";
import {
  parseTrailerCatalogQuery, readTrailerCatalog, trailerCatalogPath, type TrailerEntry, type TrailerScope,
} from "./trailerCatalog";
import { catalogScopes, rankCatalogEntries, trailerVersionOf } from "./trailerCatalogRank";

const ITEM = "0123456789abcdef0123456789abcdef";
const season = (n: number): TrailerScope => ({ kind: "season", season: n });
const SERIES: TrailerScope = { kind: "series" };

function entry(scope: TrailerScope, id: string, extra: Partial<TrailerEntry> = {}): TrailerEntry {
  return {
    scope, playback: { kind: "youtube", ytId: id.padEnd(11, "x") }, name: id, version: "original", type: "trailer", source: "tmdb", ...extra,
  };
}

const ids = (entries: TrailerEntry[]) => entries.map((e) => e.name);

describe("catalogue › l'ordre des portées", () => {
  it("un épisode de S : S, les saisons d'avant (la plus proche d'abord), la série, puis les suivantes", () => {
    expect(catalogScopes({ kind: "season", season: 3, seasons: [1, 2, 3, 4, 5] }))
      .toEqual([season(3), season(2), season(1), SERIES, season(4), season(5)]);
  });

  it("une série : la série, puis ses saisons dans l'ordre ; les spéciaux et les doublons n'en sont pas", () => {
    expect(catalogScopes({ kind: "series", seasons: [2, 0, 1, 2] })).toEqual([SERIES, season(1), season(2)]);
  });

  it("une série sans saison numérotée, un épisode des spéciaux : la série seule", () => {
    expect(catalogScopes({ kind: "series", seasons: [] })).toEqual([SERIES]);
    expect(catalogScopes({ kind: "season", season: 0, seasons: [0] })).toEqual([SERIES]);
  });

  it("un film : le film", () => {
    expect(catalogScopes({ kind: "movie" })).toEqual([{ kind: "movie" }]);
  });
});

describe("catalogue › la version, d'après la langue du serveur", () => {
  it("serveur français : VF, VOSTFR (toutes écritures), VO", () => {
    expect(trailerVersionOf({ name: "Rick et Morty - saison 6 Bande-annonce VF" }, "fr")).toBe("localized");
    expect(trailerVersionOf({ name: "Rick et Morty - saison 9 Bande-annonce VO STFR" }, "fr")).toBe("subtitled");
    expect(trailerVersionOf({ name: "Bande-annonce (2) VOST" }, "fr")).toBe("subtitled");
    expect(trailerVersionOf({ name: "Dune Bande-annonce VOSTFR", lang: "fr" }, "fr")).toBe("subtitled");
    expect(trailerVersionOf({ name: "Teaser VO", lang: "fr" }, "fr")).toBe("original");
    expect(trailerVersionOf({ name: "Bande-annonce officielle", lang: "fr" }, "fr-FR")).toBe("localized");
    expect(trailerVersionOf({ name: "Official Trailer", lang: "en" }, "fr")).toBe("original");
  });

  it("serveur anglais : la version anglaise d'abord, une VF n'y est pas « localisée »", () => {
    expect(trailerVersionOf({ name: "Official Trailer", lang: "en" }, "en")).toBe("localized");
    expect(trailerVersionOf({ name: "Bande-annonce VF", lang: "fr" }, "en")).toBe("original");
    expect(trailerVersionOf({ name: "Bande-annonce VOSTFR" }, "en")).toBe("original");
    expect(trailerVersionOf({ name: "Trailer (Subtitled)" }, "en")).toBe("subtitled");
  });

  it("sans marque ni code : inconnue ; un mot qui contient « vo » n'est pas une VO", () => {
    expect(trailerVersionOf({ name: "Trailer" }, "fr")).toBe("unknown");
    expect(trailerVersionOf({ name: "Voyage au bout de l'enfer" }, "fr")).toBe("unknown");
  });
});

describe("catalogue › le rang", () => {
  it("dans une portée : locale, AlloCiné VF, AlloCiné VOSTFR, la langue du serveur, sous-titrée, VO, inconnue, AlloCiné VO", () => {
    const scope = season(2);
    const shuffled = [
      entry(scope, "allocine-vo", { source: "allocine", version: "original" }),
      entry(scope, "unknown", { source: "jellyfin", version: "unknown" }),
      entry(scope, "tmdb-vo", { version: "original" }),
      entry(scope, "tmdb-vost", { version: "subtitled" }),
      entry(scope, "tmdb-vf", { version: "localized" }),
      entry(scope, "allocine-vost", { source: "allocine", version: "subtitled" }),
      entry(scope, "allocine-vf", { source: "allocine", version: "localized" }),
      { ...entry(scope, "local", { source: "local", version: "unknown" }), playback: { kind: "jellyfin" as const, itemId: ITEM } },
    ];
    expect(ids(rankCatalogEntries(shuffled, [scope]))).toEqual([
      "local", "allocine-vf", "allocine-vost", "tmdb-vf", "tmdb-vost", "tmdb-vo", "unknown", "allocine-vo",
    ]);
  });

  it("une bande-annonce avant un teaser, à palier égal ; la langue du serveur avant la VO, d'une portée à l'autre", () => {
    const list = [
      entry(SERIES, "series-trailer", { version: "localized" }),
      entry(season(1), "s1-teaser", { version: "localized", type: "teaser" }),
      entry(season(1), "s1-trailer", { version: "original" }),
      entry(season(1), "s1-trailer-vf", { version: "localized" }),
    ];
    expect(ids(rankCatalogEntries(list, [season(1), SERIES]))).toEqual(["s1-trailer-vf", "s1-teaser", "series-trailer", "s1-trailer"]);
  });

  it("une vidéo rendue par deux sources ne compte qu'une fois ; hors des portées, rien ; huit au plus", () => {
    const same = entry(SERIES, "dup", { source: "jellyfin", version: "unknown" });
    const list = [same, { ...same, source: "tmdb" as const, version: "localized" as const }, entry(season(9), "elsewhere")];
    expect(rankCatalogEntries(list, [SERIES])).toEqual([{ ...same, source: "tmdb", version: "localized" }]);
    const many = Array.from({ length: 12 }, (_, i) => entry(SERIES, `n${i}`));
    expect(rankCatalogEntries(many, [SERIES])).toHaveLength(8);
  });

  it("Rick et Morty, un épisode de S7 : la VF de S6 passe devant les promos anglaises de S7 ; la VO ensuite, portée par portée", () => {
    const list = [
      entry(season(7), "s7-promo-en", { version: "original", type: "teaser" }),
      entry(season(6), "s6-vf", { source: "allocine", version: "localized" }),
      entry(season(6), "s6-en"),
      entry(season(5), "s5-vost-tmdb", { version: "subtitled" }),
      entry(season(5), "s5-vost", { source: "allocine", version: "subtitled" }),
    ];
    const scopes = catalogScopes({ kind: "season", season: 7, seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9] });
    expect(ids(rankCatalogEntries(list, scopes))).toEqual(["s6-vf", "s5-vost", "s5-vost-tmdb", "s7-promo-en", "s6-en"]);
  });

  it("serveur anglais : la VO anglaise de la saison en cours EST sa langue, elle passe en tête", () => {
    const list = [entry(season(6), "s6-other", { version: "original" }), entry(season(7), "s7-en", { version: "localized", type: "teaser" })];
    expect(ids(rankCatalogEntries(list, catalogScopes({ kind: "season", season: 7, seasons: [6, 7] })))).toEqual(["s7-en", "s6-other"]);
  });

  it("Rick et Morty, un épisode de S7 (sans vidéo de S7) : la VF de S6, les VO d'avant, puis les saisons suivantes", () => {
    const allocine = [
      entry(season(1), "s1-promo", { source: "allocine", version: "original" }),
      entry(season(6), "s6-vf", { source: "allocine", version: "localized" }),
      entry(season(8), "s8-vost", { source: "allocine", version: "subtitled" }),
      entry(season(9), "s9-vostfr", { source: "allocine", version: "subtitled" }),
    ];
    const tmdb = [entry(SERIES, "series-promos-en"), entry(season(8), "s8-en")];
    const scopes = catalogScopes({ kind: "season", season: 7, seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9] });
    const ranked = rankCatalogEntries([...allocine, ...tmdb], scopes);
    expect(ranked[0].name).toBe("s6-vf");
    expect(ids(ranked)).toEqual(["s6-vf", "s1-promo", "series-promos-en", "s8-vost", "s9-vostfr", "s8-en"]);
  });

  it("Rick et Morty, un épisode de S9 : la VO STFR de S9 en tête", () => {
    const list = [
      entry(season(6), "s6-vf", { source: "allocine", version: "localized" }),
      entry(season(9), "s9-vostfr", { source: "allocine", version: "subtitled" }),
    ];
    const scopes = catalogScopes({ kind: "season", season: 9, seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9] });
    expect(rankCatalogEntries(list, scopes)[0].name).toBe("s9-vostfr");
  });

  it("Malcolm S5E13 : aucune vidéo de saison, celle de la série", () => {
    const scopes = catalogScopes({ kind: "season", season: 5, seasons: [1, 2, 3, 4, 5, 6, 7] });
    expect(ids(rankCatalogEntries([entry(SERIES, "malcolm-series", { version: "localized" })], scopes))).toEqual(["malcolm-series"]);
  });

  it("un film : ses bandes-annonces, la VF d'abord", () => {
    const movie: TrailerScope = { kind: "movie" };
    const list = [entry(movie, "en"), entry(movie, "vf", { version: "localized" })];
    expect(ids(rankCatalogEntries(list, catalogScopes({ kind: "movie" })))).toEqual(["vf", "en"]);
  });
});

describe("catalogue › la demande", () => {
  it("relit exactement ce que le chemin écrit", () => {
    for (const request of [
      { itemId: ITEM, lang: "fr" },
      { tmdbId: 60625, mediaType: "tv" as const, season: 6, lang: "fr" },
      { tmdbId: 438631, mediaType: "movie" as const },
    ]) {
      const path = trailerCatalogPath(request)!;
      expect(path.startsWith("/api/trailers/catalog?")).toBe(true);
      expect(parseTrailerCatalogQuery(Object.fromEntries(new URLSearchParams(path.split("?")[1])))).toEqual(request);
    }
  });

  it("refuse une saison sur un film, deux titres à la fois, un identifiant mal formé", () => {
    expect(trailerCatalogPath({ tmdbId: 1, mediaType: "movie", season: 2 })).toBeNull();
    expect(parseTrailerCatalogQuery({ tmdbId: "1", mediaType: "movie", season: "2" })).toBeNull();
    expect(parseTrailerCatalogQuery({ itemId: ITEM, tmdbId: "1" })).toBeNull();
    expect(parseTrailerCatalogQuery({ itemId: "../x" })).toBeNull();
    expect(parseTrailerCatalogQuery({ tmdbId: "1", mediaType: "tv", season: "-1" })).toBeNull();
  });
});

describe("catalogue › la lecture défensive de la réponse", () => {
  it("écarte les entrées illisibles, garde les autres", () => {
    const good = entry(season(2), "good");
    const read = readTrailerCatalog({
      entries: [good, { ...good, playback: { kind: "vimeo", id: "1" } }, { ...good, version: "vf" }, null],
      complete: false,
      language: "fr",
    });
    expect(read).toEqual({ entries: [good], complete: false, language: "fr" });
    expect(readTrailerCatalog({ nope: true })).toBeNull();
  });
});
