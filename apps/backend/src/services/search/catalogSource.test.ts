import { describe, expect, it } from "vitest";
import { toCatalogItem } from "./catalogSource";

/**
 * Le relevé garde, de `ProviderIds`, l'identifiant TMDB du titre et — pour un
 * film seulement — celui de sa saga : c'est ce que lit `sagaMembers.ts`.
 */

describe("toCatalogItem — identifiants TMDB", () => {
  it("un film garde son identifiant TMDB et celui de sa saga", () => {
    const item = toCatalogItem({
      Id: "a".repeat(32),
      Name: "Harry Potter à l'école des sorciers",
      Type: "Movie",
      ProviderIds: { Imdb: "tt0241527", Tmdb: "671", TmdbCollection: "1241" },
    });
    expect(item).toMatchObject({ tmdbId: "671", tmdbCollection: "1241" });
  });

  it("la casse des clés ne compte pas", () => {
    const item = toCatalogItem({ Id: "b".repeat(32), Name: "Rocky", Type: "Movie", ProviderIds: { tmdb: "1366", tmdbcollection: "1575" } });
    expect(item).toMatchObject({ tmdbId: "1366", tmdbCollection: "1575" });
  });

  it("une série ou une collection ne rejoint jamais une saga", () => {
    const series = toCatalogItem({ Id: "c".repeat(32), Name: "The Office", Type: "Series", ProviderIds: { Tmdb: "2316", TmdbCollection: "9" } });
    const boxSet = toCatalogItem({ Id: "d".repeat(32), Name: "Harry Potter - Saga", Type: "BoxSet", ProviderIds: { Tmdb: "1241" } });
    expect(series).toMatchObject({ tmdbId: "2316", tmdbCollection: null });
    expect(boxSet).toMatchObject({ tmdbId: "1241", tmdbCollection: null });
  });

  it("un identifiant absent ou illisible vaut null", () => {
    expect(toCatalogItem({ Id: "e".repeat(32), Name: "Sans fournisseur", Type: "Movie" })).toMatchObject({ tmdbId: null, tmdbCollection: null });
    const odd = toCatalogItem({ Id: "f".repeat(32), Name: "Bizarre", Type: "Movie", ProviderIds: { Tmdb: "abc", TmdbCollection: "0" } });
    expect(odd).toMatchObject({ tmdbId: null, tmdbCollection: null });
  });
});
