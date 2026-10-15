import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { deletedItemMatcher, forgetDeletedItems, withoutItems } from "./deletionCache";
import { deleteBatch } from "./useLibraryDeletion";

const SERIES = "a".repeat(32);
const FILM = "b".repeat(32);
const KEPT = "c".repeat(32);

describe("withoutItems", () => {
  const matches = deletedItemMatcher([SERIES, FILM]);

  it("retire les titres des pages d'une grille infinie et corrige leur compte", () => {
    const catalog = {
      pages: [
        { Items: [{ Id: FILM }, { Id: KEPT }], TotalRecordCount: 62, _serverCount: 2 },
        { Items: [{ Id: SERIES }], TotalRecordCount: 62, _serverCount: 1 },
      ],
      pageParams: [0, 2],
    };
    const next = withoutItems(catalog, matches);
    expect(next.pages.map((p) => p.Items.map((i) => i.Id))).toEqual([[KEPT], []]);
    expect(next.pages.map((p) => p.TotalRecordCount)).toEqual([61, 61]);
    expect(next.pageParams).toBe(catalog.pageParams);
  });

  it("retire les épisodes et saisons d'une série supprimée, et le meilleur résultat de la recherche", () => {
    const search = {
      top: { kind: "item", hit: { item: { Id: SERIES }, score: 1 } },
      movies: [{ item: { Id: FILM }, score: 1 }, { item: { Id: KEPT }, score: 1 }],
      series: [],
      episodes: [{ Id: "e1", SeriesId: SERIES }, { Id: "e2", SeriesId: KEPT, SeasonId: "x" }],
    };
    const next = withoutItems(search, matches);
    expect(next.top).toBeNull();
    expect(next.movies.map((h) => h.item.Id)).toEqual([KEPT]);
    expect(next.episodes.map((e) => e.Id)).toEqual(["e2"]);
  });

  it("rend la MÊME référence quand rien n'est concerné (aucun rendu de plus)", () => {
    const data = { Items: [{ Id: KEPT }], TotalRecordCount: 1, nested: [[{ Id: KEPT }]] };
    expect(withoutItems(data, matches)).toBe(data);
  });

  it("compare les identifiants sans tirets ni casse", () => {
    const dashed = `${FILM.slice(0, 8)}-${FILM.slice(8, 12)}-${FILM.slice(12, 16)}-${FILM.slice(16, 20)}-${FILM.slice(20)}`.toUpperCase();
    expect(withoutItems([{ Id: dashed }], matches)).toEqual([]);
  });
});

describe("forgetDeletedItems", () => {
  it("vide les rangées, la recherche et Ma liste, oublie la fiche fermée, garde (périmée) celle qui se ferme", () => {
    const qc = new QueryClient();
    qc.setQueryData(["latest-items", "lib"], [{ Id: FILM }, { Id: KEPT }]);
    qc.setQueryData(["watchlist"], { Items: [{ Id: SERIES }], TotalRecordCount: 1 });
    qc.setQueryData(["search", "tentacle", "jet", 60], { top: null, movies: [{ item: { Id: FILM } }], series: [] });
    qc.setQueryData(["item", FILM], { Id: FILM });
    forgetDeletedItems(qc, [FILM, SERIES]);
    expect(qc.getQueryData(["latest-items", "lib"])).toEqual([{ Id: KEPT }]);
    expect(qc.getQueryData(["watchlist"])).toEqual({ Items: [], TotalRecordCount: 0 });
    expect(qc.getQueryData<{ movies: unknown[] }>(["search", "tentacle", "jet", 60])?.movies).toEqual([]);
    expect(qc.getQueryCache().find({ queryKey: ["item", FILM] })).toBeUndefined();
    expect(qc.getQueryState(["latest-items", "lib"])?.isInvalidated).toBe(true);
  });
});

describe("deleteBatch", () => {
  it("retente une fois un lot perdu, puis compte ses titres en échec sans lever", async () => {
    let calls = 0;
    const flaky = async (ids: readonly string[]) => {
      calls++;
      if (calls === 1) throw new Error("réseau");
      return { results: ids.map((id) => ({ id, outcome: "deleted" as const })) };
    };
    expect(await deleteBatch(flaky, [FILM], 0)).toEqual([{ id: FILM, outcome: "deleted" }]);
    expect(calls).toBe(2);
    const down = async () => { throw new Error("403 not_personal"); };
    expect(await deleteBatch(down, [FILM, KEPT], 0)).toEqual([{ id: FILM, outcome: "failed" }, { id: KEPT, outcome: "failed" }]);
  });
});
