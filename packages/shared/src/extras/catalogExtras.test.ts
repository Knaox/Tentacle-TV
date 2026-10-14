import { describe, expect, it } from "vitest";
import type { TrailerEntry } from "../trailers";
import { catalogEntriesByScope, catalogRowFor, catalogTiles, seasonScopeKey } from "./catalogExtras";

const entry = (scope: TrailerEntry["scope"], playback: TrailerEntry["playback"], extra: Partial<TrailerEntry> = {}): TrailerEntry => ({
  scope, playback, name: "x", version: "localized", type: "trailer", source: "allocine", ...extra,
});
const S6_VF = entry({ kind: "season", season: 6 }, { kind: "dailymotion", videoId: "x8abcde" }, { name: "Saison 6 Bande-annonce VF" });
const S6_YT = entry({ kind: "season", season: 6 }, { kind: "youtube", ytId: "aaaaaaaaaaa" }, { name: "Season 6", version: "original", source: "tmdb", type: "teaser" });
const SERIES = entry({ kind: "series" }, { kind: "youtube", ytId: "WNhH00OIPP0" }, { name: "Season 1 Promos", version: "unknown", source: "tmdb" });
const LOCAL = entry({ kind: "season", season: 6 }, { kind: "jellyfin", itemId: "0123456789abcdef0123456789abcdef" }, { source: "local" });
const t = (key: string) => key;

describe("extras › les rangées du catalogue", () => {
  it("une rangée par portée, dans l'ordre du serveur, sans les locales (déjà tuiles locales)", () => {
    const scopes = catalogEntriesByScope([S6_VF, LOCAL, SERIES, S6_YT], "fr");
    expect(catalogRowFor(scopes, "s6")?.entries).toEqual([S6_VF, S6_YT]);
    expect(catalogRowFor(scopes, "series")?.entries).toEqual([SERIES]);
    expect(catalogRowFor(scopes, "s2")).toBeNull();
    expect(catalogRowFor(null, "series")).toBeNull();
  });

  it("la clé d'une saison numérotée, rien pour une saison sans numéro ni les spéciaux", () => {
    expect(seasonScopeKey(6)).toBe("s6");
    expect(seasonScopeKey(0)).toBeNull();
    expect(seasonScopeKey(undefined)).toBeNull();
  });

  it("les tuiles disent la version (dans la langue du serveur), le genre et l'origine", () => {
    const row = catalogRowFor(catalogEntriesByScope([S6_VF, S6_YT], "fr"), "s6");
    const tiles = row ? catalogTiles(t, row) : [];
    expect(tiles.map((tile) => tile.subtitle)).toEqual([
      "common:trailerVersion_vf · common:trailerOrigin_allocine",
      "common:trailerVersion_vo · common:extraKindTeaser · common:trailerOrigin_youtube",
    ]);
    expect(tiles[0].thumbUrl).toBe("https://www.dailymotion.com/thumbnail/video/x8abcde");
    expect(tiles[1]).toMatchObject({ youtubeId: "aaaaaaaaaaa", thumbUrl: "https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg" });
  });
});
