/**
 * Garde-fous de « Tendances actuelles » (lot 1017) : la page ne demande la tête
 * (`?trendingNow=1`) que si l'application sait la rendre, que le serveur déclare
 * `reco.trending` ET que la préférence du compte n'est pas coupée ; sinon la
 * requête et sa clé de cache sont EXACTEMENT celles d'avant. Règle pure, puis la
 * vraie requête montée (React, TanStack, sans DOM) dans chaque état.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RECO_SETTINGS_KEY, type RecoSettingsData } from "../hooks/useHomeLayout";
import { useRecoPage } from "../hooks/useRecoPage";
import { acceptRecoTrendingHead, trendingHeadFromCache, wantsTrendingHead } from "./trendingHeadRequest";

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
const DECLARES = { version: "1.31.0", capabilities: ["reco.trending"] };
const SILENT = { version: "1.23.0" };
const PAGE = { state: "ready", generating: false, refining: false, exploring: false, rows: [] };

describe("wantsTrendingHead", () => {
  it("les trois conditions, et rien d'autre", () => {
    expect(wantsTrendingHead(DECLARES, SETTINGS, true)).toBe(true);
    expect(wantsTrendingHead(DECLARES, { ...SETTINGS, trendingNow: true }, true)).toBe(true);
    expect(wantsTrendingHead(DECLARES, { ...SETTINGS, trendingNow: false }, true)).toBe(false);
    expect(wantsTrendingHead(DECLARES, SETTINGS, false)).toBe(false);
    expect(wantsTrendingHead(SILENT, SETTINGS, true)).toBe(false);
    expect(wantsTrendingHead({ version: "1.30.0", capabilities: ["trailers.preview"] }, SETTINGS, true)).toBe(false);
  });
});

let qc: QueryClient;
let root: Root | null = null;
let urls: string[] = [];

function Rig() {
  useRecoPage([]);
  return null;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function render(config: Record<string, unknown>, settings: RecoSettingsData) {
  qc.setQueryData(["app-config", ""], { brandName: "Tentacle", features: { downloads: false, demo: false }, ...config });
  qc.setQueryData(RECO_SETTINGS_KEY, settings);
  root ??= createRoot(container as never);
  await act(async () => {
    root!.render(createElement(QueryClientProvider, { client: qc }, createElement(Rig)));
    await settle();
  });
  await act(settle);
}

const pageKeys = () => qc.getQueryCache().findAll({ queryKey: ["reco-page"] }).map((q) => q.queryKey);

beforeEach(() => {
  acceptRecoTrendingHead();
  urls = [];
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    urls.push(String(url));
    return new Response(JSON.stringify(PAGE), { status: 200 });
  }));
});

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
  qc.clear();
  vi.unstubAllGlobals();
});

describe("useRecoPage — la requête de la page", () => {
  it("serveur 1.31.0, préférence allumée : `?trendingNow=1`, clé à part", async () => {
    await render(DECLARES, { ...SETTINGS, trendingNow: true });
    expect(urls.filter((u) => u.includes("/api/reco/page"))).toEqual([expect.stringContaining("trendingNow=1")]);
    expect(pageKeys()).toEqual([["reco-page", "all", "trendingNow"]]);
  });

  it("préférence coupée : la requête et la clé d'avant", async () => {
    await render(DECLARES, { ...SETTINGS, trendingNow: false });
    const page = urls.filter((u) => u.includes("/api/reco/page"));
    expect(page).toHaveLength(1);
    expect(page[0]).not.toContain("trendingNow");
    expect(pageKeys()).toEqual([["reco-page", "all"]]);
  });

  it("serveur qui ne déclare rien : la requête et la clé d'avant, sans erreur", async () => {
    await render(SILENT, { ...SETTINGS, trendingNow: true });
    const page = urls.filter((u) => u.includes("/api/reco/page"));
    expect(page).toHaveLength(1);
    expect(page[0]).not.toContain("trendingNow");
    expect(pageKeys()).toEqual([["reco-page", "all"]]);
  });

  it("préchargement : rien tant que la décision n'est pas connue, sinon la même décision", () => {
    expect(trendingHeadFromCache(qc)).toEqual({ ready: false, trendingNow: false });
    qc.setQueryData(["app-config", ""], DECLARES);
    qc.setQueryData(RECO_SETTINGS_KEY, { ...SETTINGS, trendingNow: false });
    expect(trendingHeadFromCache(qc)).toEqual({ ready: true, trendingNow: false });
    qc.setQueryData(RECO_SETTINGS_KEY, { ...SETTINGS, trendingNow: true });
    expect(trendingHeadFromCache(qc)).toEqual({ ready: true, trendingNow: true });
  });
});
