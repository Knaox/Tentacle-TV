import { describe, expect, it } from "vitest";
import type { LibraryEntry, LibraryIndex } from "../../reco/candidates/libraryIndex";
import { collectAnimeKeys, countKinds, isAnimeLibraryName, kindOf } from "./affinityKinds";
import { hashUnit, memberAffinity, rankCatalog, sharedEntries, type MemberTaste } from "./affinityRanking";

/**
 * La pile commune : l'intersection des bibliothèques, le type (animés à
 * part), et l'ordre du goût commun — consensus devant, clivant derrière.
 */

function entry(key: string, extra: Partial<LibraryEntry> = {}): LibraryEntry {
  const [mediaType, id] = key.split(":");
  return {
    itemId: `it-${key}`,
    name: key,
    key,
    mediaType: mediaType as "movie" | "tv",
    tmdbId: Number(id),
    played: false,
    isFavorite: false,
    inWatchlist: false,
    inProgress: false,
    playedEpisodes: 0,
    hasPrimaryImage: true,
    hasBackdrop: false,
    communityRating: 7,
    ...extra,
  };
}

function index(entries: LibraryEntry[]): LibraryIndex {
  return { entries, byKey: new Map(entries.map((e) => [e.key, e])) };
}

function member(userId: string, entries: LibraryEntry[], extra: Partial<MemberTaste> = {}): MemberTaste {
  return { userId, library: index(entries), poolRank: new Map(), swipes: new Map(), ...extra };
}

describe("affinité — le type d'un titre", () => {
  it("reconnaît une bibliothèque d'animés à son nom, pas l'animation occidentale", () => {
    for (const name of ["Animés", "Anime", "animes", "Animes VF", "Films & Animé"]) {
      expect(isAnimeLibraryName(name)).toBe(true);
    }
    for (const name of ["Animation", "Japanimation", "Films", "Séries", "Animaux"]) {
      expect(isAnimeLibraryName(name)).toBe(false);
    }
  });

  it("un animé se signe par le genre, AniDB, le pool ou la bibliothèque", () => {
    const entries = [
      entry("tv:1", { Genres: ["Anime", "Action"] }),
      entry("tv:2", { ProviderIds: { Tmdb: "2", AniDB: "44" } }),
      entry("tv:3"),
      entry("movie:4"),
      entry("tv:5", { Genres: ["Animation"] }),
      entry("tv:6"),
    ];
    const anime = collectAnimeKeys({ entries, poolAnimeKeys: ["tv:3"], animeItemIds: new Set(["it-movie:4"]) });
    expect([...anime].sort()).toEqual(["movie:4", "tv:1", "tv:2", "tv:3"]);
    expect(kindOf(entries[3], anime)).toBe("anime");
    expect(kindOf(entries[4], anime)).toBe("series");
    expect(countKinds(entries, anime)).toEqual({ movie: 0, series: 2, anime: 4 });
  });
});

describe("affinité — la pile commune", () => {
  it("garde ce que TOUS voient, avec affiche, et que tous n'ont pas déjà vu", () => {
    const a = member("a", [
      entry("movie:1"),
      entry("movie:2", { hasPrimaryImage: false }),
      entry("movie:3", { played: true }),
      entry("movie:4", { played: true }),
      entry("movie:5"),
    ]);
    const b = member("b", [entry("movie:1"), entry("movie:2"), entry("movie:3", { played: true }), entry("movie:4")]);
    expect(sharedEntries([a, b]).map((e) => e.key)).toEqual(["movie:1", "movie:4"]);
  });

  it("le consensus passe devant le titre qui clive", () => {
    const lib = [entry("movie:1"), entry("movie:2"), entry("movie:3")];
    const a = member("a", lib, {
      swipes: new Map([["movie:1", "superlike"]]),
      poolRank: new Map([["movie:2", 0.8]]),
    });
    const b = member("b", lib, {
      swipes: new Map([["movie:1", "dislike"]]),
      poolRank: new Map([["movie:2", 0.7]]),
    });
    const keys = rankCatalog({ members: [a, b], entries: lib, kind: "movie", animeKeys: new Set(), seed: "s", max: 10 })
      .map((c) => c.key);
    expect(keys[0]).toBe("movie:2");
    expect(keys.indexOf("movie:1")).toBeGreaterThan(keys.indexOf("movie:3"));
  });

  it("ce que chacun a mis dans Ma liste remonte en tête", () => {
    const aLib = [entry("movie:1"), entry("movie:2", { inWatchlist: true })];
    const bLib = [entry("movie:1"), entry("movie:2", { inWatchlist: true })];
    const cards = rankCatalog({
      members: [member("a", aLib), member("b", bLib)],
      entries: aLib,
      kind: "movie",
      animeKeys: new Set(),
      seed: "s",
      max: 10,
    });
    expect(cards[0]).toMatchObject({ key: "movie:2", jellyfinItemId: "it-movie:2", source: "taste", reason: null });
  });

  it("ne sert que le type choisi, dans la limite demandée", () => {
    const lib = [entry("movie:1"), entry("tv:2"), entry("tv:3"), entry("tv:4"), entry("movie:5")];
    const members = [member("a", lib), member("b", lib)];
    const series = rankCatalog({ members, entries: lib, kind: "series", animeKeys: new Set(["tv:4"]), seed: "s", max: 1 });
    expect(series).toHaveLength(1);
    expect(["tv:2", "tv:3"]).toContain(series[0].key);
  });

  it("le même hasard pour une même séance, un autre pour la suivante", () => {
    const lib = Array.from({ length: 30 }, (_, i) => entry(`movie:${i + 1}`));
    const members = [member("a", lib), member("b", lib)];
    const order = (seed: string) =>
      rankCatalog({ members, entries: lib, kind: "movie", animeKeys: new Set(), seed, max: 30 }).map((c) => c.key).join();
    expect(order("séance-1")).toBe(order("séance-1"));
    expect(order("séance-1")).not.toBe(order("séance-2"));
  });

  it("l'affinité d'un membre suit ce que Tentacle sait de lui", () => {
    const m = member("a", [entry("movie:1", { played: true }), entry("movie:2")], {
      poolRank: new Map([["movie:2", 1]]),
    });
    expect(memberAffinity(m, "movie:2")).toBeCloseTo(0.9);
    expect(memberAffinity(m, "movie:1")).toBe(0.2);
    expect(memberAffinity(m, "movie:3")).toBe(0.4);
    expect(hashUnit("x")).toBeGreaterThanOrEqual(0);
    expect(hashUnit("x")).toBeLessThan(1);
  });
});
