/**
 * Le bouton « Bande-annonce » (`useItemTrailer`), monté pour de vrai (React,
 * TanStack, sans DOM) : avec la capacité `trailers.catalog`, une plateforme
 * qui suit le catalogue prend la première entrée qu'elle sait lire — un
 * ÉPISODE a donc son bouton ; sans la capacité, ou pour une plateforme
 * d'avant, la règle d'avant, sans un appel au catalogue.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrailerCatalogResponse } from "@tentacle-tv/shared";
// Les extras LOCAUX passent par le client Jellyfin : ici, aucun (compteurs à 0, rien n'est demandé).
vi.mock("./useTrailers", () => {
  const idle = () => ({ data: undefined, isSuccess: false, isError: false });
  return { useLocalTrailers: idle, useSpecialFeatures: idle };
});

import { TRAILER_PLATFORM_LEGACY, useItemTrailer, type ItemTrailer, type ItemTrailerOptions, type ItemTrailerOwner } from "./useItemTrailer";

const g = globalThis as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.window ??= globalThis;
const doc: Record<string, unknown> = { nodeType: 9, activeElement: null, addEventListener() {}, removeEventListener() {} };
doc.defaultView = { document: doc, HTMLIFrameElement: class {} };
const container = {
  nodeType: 1, tagName: "DIV", nodeName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml",
  ownerDocument: doc, addEventListener() {}, removeEventListener() {},
};

const EPISODE: ItemTrailerOwner = { Id: "0123456789abcdef0123456789abcdef", Type: "Episode", LocalTrailerCount: 0, SpecialFeatureCount: 0 };
const MOVIE: ItemTrailerOwner = { Id: "fedcba9876543210fedcba9876543210", Type: "Movie", LocalTrailerCount: 0, SpecialFeatureCount: 0, ProviderIds: { Tmdb: "438631" } };
const CATALOG: TrailerCatalogResponse = {
  entries: [
    { scope: { kind: "season", season: 6 }, playback: { kind: "dailymotion", videoId: "x8abcde" }, name: "Saison 6 Bande-annonce VF", version: "localized", type: "trailer", source: "allocine" },
    { scope: { kind: "series" }, playback: { kind: "youtube", ytId: "WNhH00OIPP0" }, name: "Season 1 Promos", version: "unknown", type: "trailer", source: "tmdb" },
  ],
  complete: true,
  language: "fr",
};
const FULL: ItemTrailerOptions = { playable: ["local", "youtube", "dailymotion"], catalog: true };
const YOUTUBE_ONLY: ItemTrailerOptions = { playable: ["local", "youtube"], catalog: true };

let qc: QueryClient;
let root: Root | null = null;
let probe: ItemTrailer;

function Rig({ item, options }: { item: ItemTrailerOwner; options: ItemTrailerOptions }) {
  probe = useItemTrailer(item, "fr", options);
  return null;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function render(item: ItemTrailerOwner, options: ItemTrailerOptions) {
  root ??= createRoot(container as never);
  await act(async () => {
    root!.render(createElement(QueryClientProvider, { client: qc }, createElement(Rig, { item, options })));
    await settle();
  });
  await act(settle);
  await act(settle);
}

function serverDeclares(capabilities: string[]) {
  qc.setQueryData(["app-config", ""], { version: "1.30.0", brandName: "Tentacle", features: { downloads: false, demo: false }, capabilities });
}

function serve() {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes("/api/trailers/catalog")) return new Response(JSON.stringify(CATALOG));
    if (url.includes("/api/tmdb/trailers")) return new Response(JSON.stringify({ videos: [] }));
    return new Response("{}", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return (route: string) => fetchMock.mock.calls.filter(([url]) => String(url).includes(route)).length;
}

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
  qc.clear();
  vi.unstubAllGlobals();
});

describe("useItemTrailer — le catalogue", () => {
  it("le lecteur complet : un ÉPISODE a son bouton, la première entrée (AlloCiné de sa saison), par le relais", async () => {
    const calls = serve();
    serverDeclares(["trailers.catalog"]);
    await render(EPISODE, FULL);
    expect(probe.target).toEqual({ kind: "relay", entry: CATALOG.entries[0] });
    expect(probe.visible).toBe(true);
    expect(probe.settled).toBe(true);
    expect(probe.entries).toEqual(CATALOG.entries);
    expect(calls("/api/tmdb/trailers")).toBe(0);
  });

  it("sans Dailymotion : la première vidéo YouTube du catalogue", async () => {
    serve();
    serverDeclares(["trailers.catalog"]);
    await render(EPISODE, YOUTUBE_ONLY);
    expect(probe.target).toMatchObject({ kind: "remote", trailer: { Url: "https://www.youtube.com/watch?v=WNhH00OIPP0" } });
    expect(probe.remote.map((t) => t.Name)).toEqual(["Season 1 Promos"]);
  });

  it("une plateforme d'avant (TV, mobile) : jamais le catalogue, la règle d'avant", async () => {
    const calls = serve();
    serverDeclares(["trailers.catalog"]);
    await render(EPISODE, TRAILER_PLATFORM_LEGACY);
    expect(calls("/api/trailers/catalog")).toBe(0);
    expect(probe.target).toBeNull();
    expect(probe.entries).toEqual([]);
  });

  it("un serveur sans la capacité : aucune requête au catalogue, la liste TMDB d'avant", async () => {
    const calls = serve();
    serverDeclares(["trailers.player"]);
    await render(MOVIE, FULL);
    expect(calls("/api/trailers/catalog")).toBe(0);
    expect(calls("/api/tmdb/trailers")).toBe(1);
    expect(probe.target).toBeNull();
    expect(probe.settled).toBe(true);
  });
});
