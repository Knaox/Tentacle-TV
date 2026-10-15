import { describe, expect, it } from "vitest";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ExternalSearchResult } from "@tentacle-tv/shared";
import { combineExternal, finalizeExternalResult } from "./useExternalSearch";

/**
 * Les résultats hors bibliothèque, réduits à ce qui s'affiche. Vigie répond
 * d'abord avec son index seul (`complete: false`), puis on relit : tant que
 * c'est le cas, la recherche dit `settling` pour que l'écran garde la place
 * de la section au lieu de la faire grandir par vagues.
 */
const result = (complete: boolean, count: number): ExternalSearchResult => ({
  provider: { pluginId: "vigie", path: "/search/provider", types: null, label: "Pas encore sur le serveur", source: "Vigie" } as ExternalSearchResult["provider"],
  query: "dune",
  correction: null,
  complete,
  items: Array.from({ length: count }, (_, i) => ({ id: `m${i}` })) as unknown as ExternalSearchResult["items"],
  moreHref: null,
});

const query = (data: ExternalSearchResult | null | undefined, extra: Partial<UseQueryResult> = {}) =>
  ({ data, isPending: data === undefined, isPlaceholderData: false, ...extra }) as UseQueryResult<ExternalSearchResult | null>;

describe("combineExternal", () => {
  it("dit `settling` pour la recherche tant qu'une réponse est incomplète", () => {
    expect(combineExternal([query(result(false, 2))], true, 1, true).settling).toBe(true);
    expect(combineExternal([query(result(true, 12))], true, 1, true).settling).toBe(false);
  });

  it("une réponse incomplète SANS titre retient aussi la place (l'index n'a rien, TMDB arrive)", () => {
    const state = combineExternal([query(result(false, 0))], true, 1, true);
    expect(state.results).toEqual([]);
    expect(state.pending).toBe(false);
    expect(state.settling).toBe(true);
  });

  it("ailleurs (filmographie), une réponse incomplète est définitive", () => {
    expect(combineExternal([query(result(false, 2))], true, 1).settling).toBe(false);
  });

  it("la réponse d'une requête précédente (frappe) ne retient rien", () => {
    expect(combineExternal([query(result(false, 2), { isPlaceholderData: true })], true, 1, true).settling).toBe(false);
  });

  it("recherche coupée : rien à retenir", () => {
    expect(combineExternal([query(result(false, 2))], false, 1, true)).toMatchObject({ settling: false, results: [] });
  });
});

describe("finalizeExternalResult", () => {
  it("laisse passer les relectures permises", () => {
    expect(finalizeExternalResult(result(false, 2), 0)?.complete).toBe(false);
    expect(finalizeExternalResult(result(false, 2), 4)?.complete).toBe(false);
  });

  it("la dernière relecture permise est définitive", () => {
    expect(finalizeExternalResult(result(false, 2), 5)?.complete).toBe(true);
    expect(finalizeExternalResult(result(false, 2), 9)?.complete).toBe(true);
  });

  it("ne touche ni une réponse complète ni une absence", () => {
    const done = result(true, 3);
    expect(finalizeExternalResult(done, 5)).toBe(done);
    expect(finalizeExternalResult(null, 5)).toBeNull();
  });
});
