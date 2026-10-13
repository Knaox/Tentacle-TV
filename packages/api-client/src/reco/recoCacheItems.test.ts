/**
 * Le lâcher d'une carte cherche son titre dans les pages en cache ET dans les
 * pages à l'écran : le serveur écarte un titre jugé de la page qu'il ressert,
 * la page de la visite le montre encore — il doit pouvoir partir d'ici.
 */
import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import type { RecoRowItem } from "../hooks/recoTypes";
import { RECO_PAGE_KEY, type RecoPage } from "../hooks/useRecoPage";
import { recoItemsOf } from "./recoCacheItems";
import { registerShownRecoPage } from "./recoRetirementState";

const item = (key: string, jellyfinItemId: string | null = null): RecoRowItem => ({
  key, mediaType: "movie", tmdbId: Number(key.split(":")[1]), title: key, year: null, posterPath: null,
  jellyfinItemId, source: "x", score: 1, voteAverage: null, reasons: [],
});
const page = (items: RecoRowItem[], featured?: RecoRowItem): RecoPage => ({
  state: "ready", signalCount: 20, generating: false, refining: false, exploring: false, generatedAt: null,
  poolGeneratedAt: null, tmdbConfigured: true, personalized: true, filter: null,
  rows: [{ key: "forYou", items }], ...(featured ? { featured: { item: featured } } : {}),
});

const cleanups: Array<() => void> = [];
afterEach(() => cleanups.splice(0).forEach((off) => off()));

describe("recoItemsOf", () => {
  it("trouve le titre d'une page À L'ÉCRAN que le cache ne contient plus", () => {
    const qc = new QueryClient();
    qc.setQueryData([RECO_PAGE_KEY, "all"], page([item("movie:2")]));
    expect(recoItemsOf(qc, "movie:1")).toEqual([]);
    cleanups.push(registerShownRecoPage(page([item("movie:1", "m1"), item("movie:2")])));
    expect(recoItemsOf(qc, "movie:1").map((i) => i.key)).toEqual(["movie:1"]);
    // La carte d'une TV ne connaît que l'item Jellyfin.
    expect(recoItemsOf(qc, "m1").map((i) => i.key)).toEqual(["movie:1"]);
  });

  it("la une compte aussi, et une page qui quitte l'écran ne compte plus", () => {
    const qc = new QueryClient();
    const off = registerShownRecoPage(page([], item("movie:5", "m5")));
    expect(recoItemsOf(qc, "movie:5").map((i) => i.key)).toEqual(["movie:5"]);
    off();
    expect(recoItemsOf(qc, "movie:5")).toEqual([]);
  });
});
