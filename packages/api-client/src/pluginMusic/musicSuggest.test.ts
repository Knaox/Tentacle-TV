/**
 * Les suggestions de l'extension pendant la frappe : rien sans la capacité
 * `music.suggest` ni sans la route déclarée (aucune requête, aucune erreur),
 * une seule requête pour une rafale de lettres, une réponse crue suggestion
 * par suggestion.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MusicSuggestion } from "@tentacle-tv/shared/music";
import { useMusicProvider } from "./useMusicProvider";
import { readMusicSuggestions, useMusicSuggest } from "./useMusicSuggest";

const g = globalThis as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.window ??= globalThis;
const doc: Record<string, unknown> = { nodeType: 9, activeElement: null, addEventListener() {}, removeEventListener() {} };
doc.defaultView = { document: doc, HTMLIFrameElement: class {} };
const container = { nodeType: 1, tagName: "DIV", nodeName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml", ownerDocument: doc, addEventListener() {}, removeEventListener() {} };

const MUSIC = { search: "/music/search", resolve: "/music/resolve", suggest: "/music/suggest" };
const SILLON = { pluginId: "sillon", name: "Sillon", configEnabled: true, music: MUSIC };

describe("suggestions de l'extension (music.suggest)", () => {
  let roots: Root[] = [];
  let seen: MusicSuggestion[] = [];
  let typed = "";
  let plugins: unknown[] = [SILLON];

  function Rig() {
    const provider = useMusicProvider(plugins as never);
    seen = useMusicSuggest(provider, typed, { debounceMs: 30 });
    return null;
  }

  async function mount(config: Record<string, unknown>) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(["app-config", ""], config);
    const root = createRoot(container as never);
    roots.push(root);
    const render = () => root.render(createElement(QueryClientProvider, { client: qc }, createElement(Rig)));
    await act(async () => render());
    return async (next: string) => {
      typed = next;
      await act(async () => render());
    };
  }

  afterEach(async () => {
    for (const root of roots) await act(async () => root.unmount());
    roots = [];
    plugins = [SILLON];
    typed = "";
    vi.unstubAllGlobals();
  });

  it("serveur sans la capacité : aucune requête, aucune suggestion", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const type = await mount({ version: "1.32.0", capabilities: ["plugins.isolatedRuntime"] });
    await type("imag");
    await act(async () => { await new Promise((r) => setTimeout(r, 80)); });
    expect(seen).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("extension sans route `suggest` : rien non plus", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    plugins = [{ ...SILLON, music: { search: "/music/search", resolve: "/music/resolve" } }];
    const type = await mount({ version: "1.32.0", capabilities: ["plugins.isolatedRuntime", "music.suggest"] });
    await type("imag");
    await act(async () => { await new Promise((r) => setTimeout(r, 80)); });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("une rafale de lettres : une seule requête, pour la dernière frappe", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ query: "imag", suggestions: [{ kind: "artist", title: "Imagine Dragons", subtitle: null, text: "Imagine Dragons" }] })));
    vi.stubGlobal("fetch", fetchMock);
    const type = await mount({ version: "1.32.0", capabilities: ["plugins.isolatedRuntime", "music.suggest"] });
    for (const next of ["i", "im", "ima", "imag"]) await type(next);
    await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("/api/plugins/sillon/music/suggest?q=imag");
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(seen.map((s) => s.title)).toEqual(["Imagine Dragons"]);
  });

  it("une réponse mal formée est filtrée, jamais crue en bloc", () => {
    expect(readMusicSuggestions(null)).toEqual([]);
    expect(readMusicSuggestions({ suggestions: [{ kind: "playlist", title: "x", text: "x" }, { kind: "track", title: "Bones", subtitle: 3, text: "Bones Imagine Dragons" }] })).toEqual([
      { kind: "track", title: "Bones", subtitle: null, text: "Bones Imagine Dragons" },
    ]);
  });
});
