/**
 * Le geste du testeur (lot 1017), côté web et bureau (TanStack v5) : « Pour vous »
 * montée, on bascule « Tendances actuelles » — la clé de la page change, la page
 * précédente sert de remplacement (`placeholderData`, passée par `select` à chaque
 * rendu), puis la nouvelle arrive. Vraie requête, vraie visite : aucune boucle de
 * rendus, et la page de l'autre clé entre (frontière de l'interrupteur).
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RECO_SETTINGS_KEY, type RecoSettingsData } from "../hooks/useHomeLayout";
import { acceptRecoTrendingHead } from "./trendingHeadRequest";
import { useRecoPageVisit, type RecoPageVisit } from "./useRecoPageVisit";

const g = globalThis as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.window ??= globalThis;
const doc: Record<string, unknown> = { nodeType: 9, activeElement: null, addEventListener() {}, removeEventListener() {} };
doc.defaultView = { document: doc, HTMLIFrameElement: class {} };
const container = {
  nodeType: 1, tagName: "DIV", nodeName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml",
  ownerDocument: doc, addEventListener() {}, removeEventListener() {},
};

const SETTINGS: RecoSettingsData = {
  personalized: true, includeVigie: true, community: true, shareHistory: true, explorationBalance: 70, providerFilter: [],
};
const item = (key: string) => ({ key, mediaType: "movie", tmdbId: 1, title: key, year: null, posterPath: null, backdropPath: null, jellyfinItemId: null, source: "x", score: 1, voteAverage: null, reasons: [] });
const pageOf = (rows: Record<string, string[]>) => ({
  state: "ready", signalCount: 20, generating: false, refining: false, exploring: false, generatedAt: null,
  poolGeneratedAt: null, tmdbConfigured: true, personalized: true, filter: null,
  rows: Object.entries(rows).map(([key, keys]) => ({ key, items: keys.map(item) })),
});
const WITH_HEAD = pageOf({ trendingNow: ["movie:20", "movie:21"], forYou: ["movie:1", "movie:2"] });
const WITHOUT = pageOf({ forYou: ["movie:1", "movie:2"], trending: ["movie:20"] });

let qc: QueryClient;
let root: Root | null = null;
let probe: RecoPageVisit;
let renders = 0;
let release: (() => void) | null = null;

function Rig() {
  renders += 1;
  probe = useRecoPageVisit([]);
  return null;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const shownRows = () => probe.data?.rows.map((row) => row.key);

beforeEach(() => {
  acceptRecoTrendingHead();
  renders = 0;
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["app-config", ""], { version: "1.31.0", capabilities: ["reco.trending"] });
  qc.setQueryData(RECO_SETTINGS_KEY, { ...SETTINGS, trendingNow: true });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (!String(url).includes("/api/reco/page")) return new Response("{}", { status: 404 });
    // La page de l'autre clé se fait attendre : la précédente sert de remplacement entre-temps.
    if (!String(url).includes("trendingNow=1")) await new Promise<void>((resolve) => { release = resolve; });
    return new Response(JSON.stringify(String(url).includes("trendingNow=1") ? WITH_HEAD : WITHOUT), { status: 200 });
  }));
});

afterEach(async () => {
  release?.();
  if (root) await act(async () => root!.unmount());
  root = null;
  qc.clear();
  vi.unstubAllGlobals();
});

describe("useRecoPageVisit — bascule de « Tendances actuelles » (TanStack v5)", () => {
  it("coupée puis rallumée, sans boucle de rendus ; chaque page entre", async () => {
    root = createRoot(container as never);
    await act(async () => {
      root!.render(createElement(QueryClientProvider, { client: qc }, createElement(Rig)));
      await settle();
    });
    await act(settle);
    expect(shownRows()).toEqual(["trendingNow", "forYou"]);

    // Coupée : nouvelle clé, la page précédente en remplacement le temps de la requête.
    await act(async () => {
      qc.setQueryData(RECO_SETTINGS_KEY, { ...SETTINGS, trendingNow: false });
      await settle();
    });
    const before = renders;
    await act(settle);
    expect(renders - before).toBeLessThan(10);
    await act(async () => {
      release?.();
      await settle();
    });
    await act(settle);
    expect(shownRows()).toEqual(["forYou", "trending"]);

    // Rallumée : la clé d'avant, encore en cache.
    await act(async () => {
      qc.setQueryData(RECO_SETTINGS_KEY, { ...SETTINGS, trendingNow: true });
      await settle();
    });
    await act(settle);
    expect(shownRows()).toEqual(["trendingNow", "forYou"]);
  });
});
