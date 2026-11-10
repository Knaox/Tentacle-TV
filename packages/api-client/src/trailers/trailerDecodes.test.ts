/**
 * Ce que le lecteur de l'appareil décode décide de ce qui se DEMANDE : un
 * lecteur qui lit le H.264 garde les requêtes d'avant ; un lecteur sans H.264
 * ni AAC (le bureau CEF) le déclare à un serveur qui sait servir le VP9 et
 * l'Opus (`trailers.openCodecs`) — et ne demande RIEN à un serveur qui ne sait
 * pas : aucun aperçu, aucune requête, aucune erreur.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrailerPreviewSubject } from "@tentacle-tv/shared";
import { declareTrailerDecodes, trailerDecodesBody, trailerDecodesQuery, trailerDeliveryHere } from "./trailerDecodes";
import { fetchTrailerResolve, prepareTrailerPlayback } from "./trailerPlayerApi";
import { fetchTrailerPreviewWarm } from "./trailerPreviewWarm";
import { useTrailerPreviewStream, type TrailerPreviewStreamState } from "./useTrailerPreviewStream";

const g = globalThis as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.window ??= globalThis;
const doc: Record<string, unknown> = { nodeType: 9, activeElement: null, addEventListener() {}, removeEventListener() {} };
doc.defaultView = { document: doc, HTMLIFrameElement: class {} };
const container = {
  nodeType: 1, tagName: "DIV", nodeName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml",
  ownerDocument: doc, addEventListener() {}, removeEventListener() {},
};

const SUBJECT: TrailerPreviewSubject = { kind: "item", itemId: "90d50b74d48412cfc9db9a256b1d0c64" };
const PREVIEW = {
  ytId: "FFUGtw7uzB4", path: "/api/trailers/hls/o%3AFFUGtw7uzB4/master.m3u8?t=abc", mimeType: "application/vnd.apple.mpegurl",
  expiresAt: Date.now() + 3_600_000, heights: [720], qualities: [],
};

let qc: QueryClient;
let root: Root | null = null;
let probe: TrailerPreviewStreamState;

function Rig() {
  probe = useTrailerPreviewStream(SUBJECT, "fr", { enabled: true });
  return null;
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
async function render() {
  root ??= createRoot(container as never);
  await act(async () => {
    root!.render(createElement(QueryClientProvider, { client: qc }, createElement(Rig)));
    await settle();
  });
  await act(settle);
}
function serverDeclares(capabilities: string[]) {
  qc.setQueryData(["app-config", ""], { version: "1.41.0", brandName: "Tentacle", features: { downloads: false, demo: false }, capabilities });
}
const urlsOf = (mock: ReturnType<typeof vi.fn>) => mock.mock.calls.map(([url]) => String(url));

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  declareTrailerDecodes(null);
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
  qc.clear();
  declareTrailerDecodes(null);
  vi.unstubAllGlobals();
});

describe("la déclaration du lecteur", () => {
  it("rien de déclaré, ou H.264 + AAC : les requêtes d'avant, sans paramètre", () => {
    expect(trailerDecodesQuery()).toBe("");
    expect(trailerDecodesBody()).toBeUndefined();
    expect(trailerDeliveryHere(false)).toBe("h264");
    declareTrailerDecodes(["h264", "aac", "vp9", "opus"]);
    expect(trailerDecodesQuery()).toBe("");
    expect(trailerDecodesBody()).toBeUndefined();
    expect(trailerDeliveryHere(false)).toBe("h264");
  });

  it("un lecteur sans H.264 ni AAC le dit, et n'a de flux que face à un serveur qui sait", () => {
    declareTrailerDecodes(["vp9", "opus"]);
    expect(trailerDecodesQuery()).toBe("&dec=vp9,opus");
    expect(trailerDecodesBody()).toEqual(["vp9", "opus"]);
    expect(trailerDeliveryHere(true)).toBe("open");
    expect(trailerDeliveryHere(false)).toBeNull();
  });
});

describe("l'aperçu d'un lecteur sans H.264 ni AAC", () => {
  it("face à un serveur qui ne sait pas servir le VP9 : AUCUNE requête, aucune erreur", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(PREVIEW)));
    vi.stubGlobal("fetch", fetchMock);
    declareTrailerDecodes(["vp9", "opus"]);
    serverDeclares(["trailers.preview", "trailers.previewWarm", "trailers.player"]);
    await render();
    expect(probe.capable).toBe(false);
    expect(probe.result).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("face à un serveur qui déclare `trailers.openCodecs` : la requête porte `dec=vp9,opus`", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(PREVIEW)));
    vi.stubGlobal("fetch", fetchMock);
    declareTrailerDecodes(["vp9", "opus"]);
    serverDeclares(["trailers.preview", "trailers.openCodecs"]);
    await render();
    expect(probe.capable).toBe(true);
    expect(urlsOf(fetchMock)).toHaveLength(1);
    expect(urlsOf(fetchMock)[0]).toContain("/api/trailers/preview?itemId=90d50b74d48412cfc9db9a256b1d0c64&lang=fr&dm=1&dec=vp9,opus");
    expect(probe.result).toMatchObject({ status: "found" });
  });

  it("un lecteur qui lit le H.264 ne regarde pas cette capacité, et sa requête n'a pas changé", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(PREVIEW)));
    vi.stubGlobal("fetch", fetchMock);
    declareTrailerDecodes(["h264", "aac", "vp9", "opus"]);
    serverDeclares(["trailers.preview"]);
    await render();
    expect(probe.capable).toBe(true);
    expect(urlsOf(fetchMock)[0]).toMatch(/\/api\/trailers\/preview\?itemId=90d50b74d48412cfc9db9a256b1d0c64&lang=fr&dm=1$/);
  });
});

describe("la préparation et le lecteur de la fiche portent la même déclaration", () => {
  it("écrivent `dec` pour un lecteur sans H.264, rien pour les autres", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: { body?: string }) => new Response(JSON.stringify({ ready: [], queued: 0 })));
    vi.stubGlobal("fetch", fetchMock);
    await fetchTrailerPreviewWarm([SUBJECT], "fr");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).not.toHaveProperty("decodes");
    await fetchTrailerResolve({ kind: "youtube", ytId: "FFUGtw7uzB4" }, "http://serveur.test");
    expect(urlsOf(fetchMock)[1]).toMatch(/\/api\/trailers\/resolve\?ytId=FFUGtw7uzB4$/);

    declareTrailerDecodes(["vp9", "opus"]);
    await fetchTrailerPreviewWarm([SUBJECT], "fr");
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body)).decodes).toEqual(["vp9", "opus"]);
    await fetchTrailerResolve({ kind: "youtube", ytId: "FFUGtw7uzB4" }, "http://serveur.test");
    expect(urlsOf(fetchMock)[3]).toMatch(/\/api\/trailers\/resolve\?ytId=FFUGtw7uzB4&dec=vp9,opus$/);
    prepareTrailerPlayback({ kind: "youtube", ytId: "FFUGtw7uzB4" });
    expect(urlsOf(fetchMock)[4]).toMatch(/\/api\/trailers\/prepare\?ytId=FFUGtw7uzB4&dec=vp9,opus$/);
  });
});
