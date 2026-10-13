/**
 * Le crochet de la requête d'aperçu, monté pour de vrai (React, TanStack, sans
 * DOM) : gardé par la capacité `trailers.preview`, il ne part qu'activé (à
 * l'intention), ne relance pas un refus, et s'abandonne sur demande.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrailerPreviewSubject } from "@tentacle-tv/shared";
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
  ytId: "FFUGtw7uzB4", path: "/api/trailers/hls/FFUGtw7uzB4/master.m3u8?t=abc", mimeType: "application/vnd.apple.mpegurl",
  expiresAt: Date.now() + 3_600_000, heights: [720], qualities: [],
};

let qc: QueryClient;
let root: Root | null = null;
let probe: TrailerPreviewStreamState;

function Rig({ enabled }: { enabled: boolean }) {
  probe = useTrailerPreviewStream(SUBJECT, "fr", { enabled });
  return null;
}

// TanStack prévient ses observateurs au tour suivant de la boucle (`notifyManager`).
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function render(enabled: boolean) {
  root ??= createRoot(container as never);
  await act(async () => {
    root!.render(createElement(QueryClientProvider, { client: qc }, createElement(Rig, { enabled })));
    await settle();
  });
  await act(settle);
}

function serverDeclares(capabilities: string[]) {
  qc.setQueryData(["app-config", ""], { version: "1.28.0", brandName: "Tentacle", features: { downloads: false, demo: false }, capabilities });
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

describe("useTrailerPreviewStream", () => {
  it("un serveur sans la capacité ne reçoit AUCUNE requête, même à l'intention", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(PREVIEW)));
    vi.stubGlobal("fetch", fetchMock);
    serverDeclares(["trailers.player"]);
    await render(true);
    expect(probe.capable).toBe(false);
    expect(probe.result).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rien n'est demandé avant l'intention, la demande part à l'activation", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(PREVIEW)));
    vi.stubGlobal("fetch", fetchMock);
    serverDeclares(["trailers.preview"]);
    await render(false);
    expect(probe.capable).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    await render(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(probe.result).toEqual({ status: "found", preview: PREVIEW });
    expect(probe.fresh).toBe(true);
  });

  it("un 404 est une réponse : rien à montrer, et pas de nouvelle demande", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "no_trailer" }), { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    serverDeclares(["trailers.preview"]);
    await render(true);
    expect(probe.result).toEqual({ status: "missing", reason: "no_trailer" });
    // Un second survol (désactivé puis réactivé) lit la réponse gardée.
    await render(false);
    await render(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(probe.fresh).toBe(true);
  });

  it("l'abandon coupe la requête en vol", async () => {
    let aborted = false;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        aborted = true;
        reject(new DOMException("aborted", "AbortError"));
      });
    })));
    serverDeclares(["trailers.preview"]);
    await render(true);
    expect(probe.result).toBeUndefined();
    await act(async () => {
      probe.cancel();
      await settle();
    });
    expect(aborted).toBe(true);
    expect(probe.result).toBeUndefined();
  });
});
