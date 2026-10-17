/**
 * L'interrupteur « Tendances actuelles » (`useTrendingNowSetting`), monté pour
 * de vrai (React, TanStack, sans DOM) : présent face à un serveur qui déclare
 * `reco.trending`, allumé par défaut ; ABSENT face à un serveur qui ne déclare
 * rien (≤ 1.23.x) ou qui ne la connaît pas — sans erreur.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RECO_SETTINGS_KEY, type RecoSettingsData } from "../hooks/useHomeLayout";
import { useTrendingNowSetting, type TrendingNowSetting } from "./trendingHead";

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

let qc: QueryClient;
let root: Root | null = null;
let probe: TrendingNowSetting;

function Rig() {
  probe = useTrendingNowSetting();
  return null;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function render() {
  root ??= createRoot(container as never);
  await act(async () => {
    root!.render(createElement(QueryClientProvider, { client: qc }, createElement(Rig)));
    await settle();
  });
}

function server(config: Record<string, unknown>, settings: RecoSettingsData) {
  qc.setQueryData(["app-config", ""], { brandName: "Tentacle", features: { downloads: false, demo: false }, ...config });
  qc.setQueryData(RECO_SETTINGS_KEY, settings);
}

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
});

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
  qc.clear();
  vi.unstubAllGlobals();
});

describe("useTrendingNowSetting", () => {
  it("serveur 1.31.0 : l'interrupteur existe, allumé par défaut, et suit le choix du compte", async () => {
    server({ version: "1.31.0", capabilities: ["reco.trending"] }, SETTINGS);
    await render();
    expect(probe.available).toBe(true);
    expect(probe.enabled).toBe(true);
    qc.setQueryData(RECO_SETTINGS_KEY, { ...SETTINGS, trendingNow: false });
    await act(settle);
    expect(probe.enabled).toBe(false);
  });

  it("serveur qui ne déclare rien : aucun interrupteur, sans erreur", async () => {
    server({ version: "1.23.0" }, SETTINGS);
    await render();
    expect(probe.available).toBe(false);
  });

  it("serveur qui déclare sans la clé (1.30.0) : aucun interrupteur", async () => {
    server({ version: "1.30.0", capabilities: ["trailers.preview"] }, SETTINGS);
    await render();
    expect(probe.available).toBe(false);
  });
});
