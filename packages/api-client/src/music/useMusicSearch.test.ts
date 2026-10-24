/**
 * La recherche musique pendant la frappe, montée pour de vrai (React,
 * TanStack, sans DOM) : anti-rebond, annulation, réponse précédente gardée,
 * barre vidée, et RIEN sans la capacité du serveur.
 */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MusicSearchResponse } from "@tentacle-tv/shared/music";

let capable = true;
const calls: { q: string; signal: AbortSignal | undefined }[] = [];
const answers = new Map<string, (r: MusicSearchResponse) => void>();

vi.mock("../hooks/useServerCapabilities", () => ({ useServerCapability: () => capable }));
vi.mock("./musicApi", () => ({
  musicApi: {
    search: (q: string, _limit: number, signal?: AbortSignal) =>
      new Promise<MusicSearchResponse>((resolve) => {
        calls.push({ q, signal });
        answers.set(q, resolve);
      }),
  },
}));

const { useMusicSearch } = await import("./useMusicSearch");

const g = globalThis as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.window ??= globalThis;
const doc: Record<string, unknown> = { nodeType: 9, activeElement: null, addEventListener() {}, removeEventListener() {} };
doc.defaultView = { document: doc, HTMLIFrameElement: class {} };
const container = { nodeType: 1, tagName: "DIV", nodeName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml", ownerDocument: doc, addEventListener() {}, removeEventListener() {} };

const reply = (q: string): MusicSearchResponse => ({ query: q, tracks: [], albums: [], artists: [], playlists: [], tookMs: 1 });
const wait = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

let root: Root;
let qc: QueryClient;
let probe: ReturnType<typeof useMusicSearch>;
function Rig({ text }: { text: string }) {
  probe = useMusicSearch(text, { debounceMs: 60 });
  return null;
}
async function type(text: string) {
  await act(async () => root.render(createElement(QueryClientProvider, { client: qc }, createElement(Rig, { text }))));
}

beforeEach(() => {
  capable = true;
  calls.length = 0;
  answers.clear();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  root = createRoot(container as never);
});
afterEach(async () => {
  await act(async () => root.unmount());
});

describe("useMusicSearch", () => {
  it("une rafale de lettres : une seule requête, la dernière frappe", async () => {
    // Monté vide (la barre de recherche) ; un montage AVEC du texte cherche tout de suite.
    await type("");
    await type("k");
    await type("ke");
    await type("Kev ");
    await wait(100);
    expect(calls.map((c) => c.q)).toEqual(["kev"]);
    await act(async () => answers.get("kev")!(reply("kev")));
    await wait(0);
    expect(probe.data?.query).toBe("kev");
    expect(probe.pending).toBe(false);
  });

  it("la réponse précédente reste affichée ; la requête dépassée est annulée", async () => {
    await type("polka");
    await wait(100);
    await act(async () => answers.get("polka")!(reply("polka")));
    await type("polka d");
    await wait(100);
    expect(probe.data?.query).toBe("polka");
    expect(probe.pending).toBe(true);
    await type("polka do");
    await wait(100);
    expect(calls.find((c) => c.q === "polka d")?.signal?.aborted).toBe(true);
  });

  it("barre vidée : plus rien, tout de suite", async () => {
    await type("ete");
    await wait(100);
    await act(async () => answers.get("ete")!(reply("ete")));
    await type("");
    await wait(0);
    expect(probe.data).toBeUndefined();
  });

  it("sans la capacité `music.library` : aucune requête", async () => {
    capable = false;
    await type("kevin");
    await wait(100);
    expect(calls).toEqual([]);
  });
});
