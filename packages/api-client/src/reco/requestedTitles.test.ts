/**
 * Un titre DEMANDÉ sort des recommandations du compte — tout de suite s'il
 * est libre, au LÂCHER s'il est tenu (jamais sous le curseur). Masqué, pas
 * jugé : rien d'autre ne change dans les caches.
 */

import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecoRowItem } from "../hooks/recoTypes";
import { RECO_PAGE_KEY, selectRecoPage, type RecoPage } from "../hooks/useRecoPage";
import { RECO_LEAVE_MS, isRecoItemJudged, releaseRecoCard } from "./recoRetirement";
import { holdRecoCard, resetRecoRetirementForTests } from "./recoRetirementState";
import { markTitleRequested, requestedTitleKeysOf, retireRequestedTitles } from "./requestedTitles";

const reco = (key: string): RecoRowItem => ({
  key, mediaType: key.startsWith("tv:") ? "tv" : "movie", tmdbId: Number(key.split(":")[1]), title: key,
  year: null, posterPath: null, backdropPath: null, jellyfinItemId: null, source: "x", score: 1,
  voteAverage: null, reasons: [], providers: null,
});
const page = (items: RecoRowItem[]): RecoPage => ({
  state: "ready", signalCount: 20, generating: false, refining: false, exploring: false,
  generatedAt: null, poolGeneratedAt: null, tmdbConfigured: true, personalized: true, filter: null,
  rows: [{ key: "row0", items }],
});

let qc: QueryClient;
const keys = () => (qc.getQueryData<RecoPage>([RECO_PAGE_KEY, "all"])?.rows[0]?.items ?? []).map((i) => i.key);

beforeEach(() => {
  vi.useFakeTimers();
  resetRecoRetirementForTests();
  qc = new QueryClient();
  qc.setQueryData([RECO_PAGE_KEY, "all"], page([reco("movie:603"), reco("tv:1399"), reco("movie:11")]));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("un titre demandé quitte les recommandations", () => {
  it("tout de suite quand personne ne le tient, et aucune page servie ensuite ne le remontre", async () => {
    markTitleRequested(qc, "movie:603");
    await vi.advanceTimersByTimeAsync(1);
    expect(keys()).toEqual(["tv:1399", "movie:11"]);
    expect(selectRecoPage(page([reco("movie:603"), reco("movie:11")])).rows[0].items.map((i) => i.key)).toEqual(["movie:11"]);
    expect([...requestedTitleKeysOf(qc)]).toEqual(["movie:603"]);
  });

  it("au LÂCHER quand sa carte est tenue : « demandé » vaut jugé pour la règle du retrait", async () => {
    holdRecoCard("tv:1399");
    markTitleRequested(qc, "tv:1399");
    await vi.advanceTimersByTimeAsync(RECO_LEAVE_MS + 1);
    expect(keys()).toContain("tv:1399");
    expect(isRecoItemJudged(qc, reco("tv:1399"))).toBe(true);
    releaseRecoCard(qc, "tv:1399");
    await vi.advanceTimersByTimeAsync(RECO_LEAVE_MS + 1);
    expect(keys()).toEqual(["movie:603", "movie:11"]);
  });

  it("une demande apprise en relisant la liste (page de l'extension) suit la même règle", async () => {
    holdRecoCard("movie:11");
    retireRequestedTitles(qc, ["movie:603", "movie:11"]);
    await vi.advanceTimersByTimeAsync(1);
    expect(keys()).toEqual(["tv:1399", "movie:11"]);
  });

  it("deux fois la même demande ne double rien", () => {
    markTitleRequested(qc, "movie:603");
    markTitleRequested(qc, "movie:603");
    expect(qc.getQueryData(["reco", "requested"])).toEqual(["movie:603"]);
  });
});
