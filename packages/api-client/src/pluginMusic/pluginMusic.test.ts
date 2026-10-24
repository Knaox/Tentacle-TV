/**
 * Les points d'extension musique côté clients : règles pures (fournisseur,
 * fusion où la bibliothèque gagne, anticipation dédoublonnée, refus rendus dans
 * la liste fermée) et crochets montés pour de vrai face à un serveur qui ne
 * déclare RIEN — aucune requête, aucune section, aucune erreur.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExternalMusicSearchPage, MusicTrack } from "@tentacle-tv/shared/music";
import { findMusicProvider, musicRouteUrl, type MusicProvider } from "./musicProvider";
import { mergeExternalMusicPages, readMusicSearchPage } from "./musicSearchMerge";
import { likeExternalTrack, prefetchMusic, resetMusicPrefetchForTests, resolveMusicSource, resolveMusicSources } from "./musicRequests";
import { useMusicProvider } from "./useMusicProvider";
import { useMusicSearch, type MusicSearchState } from "./useMusicSearch";
import { isMusicEvent } from "./useMusicEvents";

const g = globalThis as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.window ??= globalThis;
const doc: Record<string, unknown> = { nodeType: 9, activeElement: null, addEventListener() {}, removeEventListener() {} };
doc.defaultView = { document: doc, HTMLIFrameElement: class {} };
const container = { nodeType: 1, tagName: "DIV", nodeName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml", ownerDocument: doc, addEventListener() {}, removeEventListener() {} };

const MUSIC = { search: "/music/search", resolve: "/music/resolve", prefetch: "/music/prefetch", like: "/music/like", labels: { fr: "Ailleurs" } };
const SILLON = { pluginId: "sillon", name: "Sillon", configEnabled: true, music: MUSIC };

const track = (key: string, recording: string | null): MusicTrack => ({
  key, jellyfinId: null, external: { pluginId: "sillon", id: key }, title: key, artists: [], album: null, durationMs: null,
  trackNumber: null, discNumber: null, year: null, artworkUrl: null,
  mbids: { recording, release: null, releaseGroup: null, artists: [] }, availability: "remote", format: null, favorite: false,
});
const page = (tracks: MusicTrack[], complete: boolean, cursor: string | null): ExternalMusicSearchPage => ({ query: "q", complete, cursor, tracks, albums: [], artists: [] });
const R1 = "11111111-1111-4111-8111-111111111111";
const R2 = "22222222-2222-4222-8222-222222222222";

describe("fournisseur de musique", () => {
  it("prend une extension active, configurée, au contrat `music` valide", () => {
    expect(findMusicProvider([SILLON])).toEqual({ pluginId: "sillon", name: "Sillon", music: MUSIC });
  });

  it("ignore une extension éteinte, sans contrat ou au contrat mal formé", () => {
    expect(findMusicProvider([{ ...SILLON, configEnabled: false }])).toBeNull();
    expect(findMusicProvider([{ pluginId: "seer", name: "Vigie", configEnabled: true }])).toBeNull();
    expect(findMusicProvider([{ ...SILLON, music: { search: "https://evil.example/x", resolve: "/r" } }])).toBeNull();
    expect(findMusicProvider(null)).toBeNull();
  });

  it("construit les routes sous /api/plugins/<id>", () => {
    const provider = findMusicProvider([SILLON]) as MusicProvider;
    expect(musicRouteUrl(provider, "/music/search", { q: "daft punk", limit: 20, cursor: null })).toBe("/api/plugins/sillon/music/search?q=daft+punk&limit=20");
  });
});

describe("fusion des pages progressives", () => {
  it("met les pages bout à bout, chaque titre une fois, et la bibliothèque gagne", () => {
    const merged = mergeExternalMusicPages(
      [page([track("a", R1), track("b", null)], false, "c1"), page([track("b", null), track("c", R2.toUpperCase())], true, null)],
      new Set([R2]),
    );
    expect(merged.tracks.map((t) => t.key)).toEqual(["a", "b"]);
    expect(merged.complete).toBe(true);
  });

  it("v2 : une page `replace` remplace tout ce qui précède, une page d'ajout d'après s'y ajoute", () => {
    const provisional = { ...page([track("a", null), track("b", null)], false, "c1"), replace: true, provisional: true };
    const revised = { ...page([track("b", null), track("c", null)], false, "c2"), replace: true };
    const appended = page([track("d", null)], true, null);
    const merged = mergeExternalMusicPages([provisional, revised, appended], new Set());
    expect(merged.tracks.map((t) => t.key)).toEqual(["b", "c", "d"]);
    expect(merged.provisional).toBe(false);
    expect(mergeExternalMusicPages([provisional], new Set()).provisional).toBe(true);
    expect(readMusicSearchPage({ ...provisional, replace: true, provisional: true }, "q")).toMatchObject({ replace: true, provisional: true });
  });

  it("ne croit qu'une réponse qui a la forme d'une page", () => {
    expect(readMusicSearchPage({ tracks: "x" }, "q")).toBeNull();
    expect(readMusicSearchPage({ tracks: [], albums: [], artists: [], complete: false, cursor: "" }, "q")).toEqual(page([], false, null));
  });
});

describe("appels à l'extension", () => {
  const provider = findMusicProvider([SILLON]) as MusicProvider;
  beforeEach(() => resetMusicPrefetchForTests());
  afterEach(() => vi.unstubAllGlobals());

  it("l'anticipation part une fois par titre et par intention, `press` toujours, et ne remonte jamais d'erreur", async () => {
    const fetchMock = vi.fn(async () => { throw new Error("réseau coupé"); });
    vi.stubGlobal("fetch", fetchMock);
    prefetchMusic(provider, ["a", "b"], "hover", 1_000);
    prefetchMusic(provider, ["a"], "hover", 2_000);
    prefetchMusic(provider, ["a"], "press", 2_000);
    prefetchMusic(provider, ["a"], "press", 2_001);
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("un survol se redit au bout de 5 s (l'extension l'oublie après 8 s), un résultat pas avant 30 s", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    prefetchMusic(provider, ["a"], "hover", 0);
    prefetchMusic(provider, ["a"], "hover", 4_999);
    prefetchMusic(provider, ["a"], "hover", 5_000);
    prefetchMusic(provider, ["a"], "results", 0);
    prefetchMusic(provider, ["a"], "results", 29_999);
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("un refus HTTP devient une raison de la liste fermée", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("non", { status: 403 })));
    expect(await likeExternalTrack(provider, "a", true)).toEqual({ ok: false, reason: "forbidden", message: null });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, state: "pending", operationId: "op1", jellyfinId: null }))));
    expect(await likeExternalTrack(provider, "a", true)).toEqual({ ok: true, state: "pending", operationId: "op1", jellyfinId: null });
  });

  it("« réessaie plus tard » (contrat `retry`) : lu par le lecteur d'aujourd'hui, une simple absence de source pour un client d'avant", async () => {
    const busy = { sources: [], retry: { reason: "budget", afterMs: 4_000 } };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(busy))));
    expect(await resolveMusicSource(provider, "a")).toEqual({ retryAfterMs: 4_000 });
    expect((await resolveMusicSources(provider, ["a"])).size).toBe(0);
    const source = { trackKey: "k", url: "/s", origin: "plugin", complete: true, sizeBytes: null, durationMs: null, format: null, replayGain: null, expiresAt: null };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ sources: [{ externalId: "a", source }] }))));
    expect(await resolveMusicSource(provider, "a")).toEqual({ source });
    // Sans source et sans « réessaie », ou une raison inconnue : une absence de source, comme avant.
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ sources: [], retry: { reason: "autre", afterMs: 10 } }))));
    expect(await resolveMusicSource(provider, "a")).toBeNull();
  });

  it("reconnaît les événements music:* et eux seuls", () => {
    expect(isMusicEvent({ type: "music:resolved" })).toBe(true);
    expect(isMusicEvent({ type: "music:whatever" })).toBe(false);
    expect(isMusicEvent({ type: "home:update" })).toBe(false);
  });
});

describe("crochets montés, selon ce que le serveur déclare", () => {
  let roots: Root[] = [];
  let qc: QueryClient;
  let seen: { provider: MusicProvider | null; search: MusicSearchState } | null = null;

  let observers = 1;
  function Rig() {
    const provider = useMusicProvider([SILLON]);
    // Octave observe la même recherche deux fois (avant et après le tri de la bibliothèque).
    const first = useMusicSearch(provider, "daft punk");
    const second = useMusicSearch(provider, observers > 1 ? "daft punk" : "");
    seen = { provider, search: observers > 1 ? second : first };
    return null;
  }

  async function mount(config: Record<string, unknown>) {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(["app-config", ""], config);
    const root = createRoot(container as never);
    roots.push(root);
    await act(async () => {
      root.render(createElement(QueryClientProvider, { client: qc }, createElement(Rig)));
      await new Promise((r) => setTimeout(r, 20));
    });
  }

  afterEach(async () => {
    for (const root of roots) await act(async () => root.unmount());
    roots = [];
    observers = 1;
    vi.unstubAllGlobals();
  });

  it("serveur qui ne déclare rien (1.31) : aucun fournisseur, aucune requête, aucune section, sans erreur", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await mount({ version: "1.31.1" });
    expect(seen?.provider).toBeNull();
    expect(seen?.search).toEqual({ tracks: [], albums: [], artists: [], complete: true, provisional: false, pending: false, failed: false, available: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("capacité déclarée : la recherche part et suit les pages jusqu'à `complete`", async () => {
    const pages = [page([track("a", R1)], false, "c1"), page([track("b", null)], true, null)];
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(url.includes("cursor=c1") ? pages[1] : pages[0])));
    vi.stubGlobal("fetch", fetchMock);
    await mount({ version: "1.32.0", capabilities: ["plugins.isolatedRuntime"] });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(seen?.provider?.pluginId).toBe("sillon");
    expect(seen?.search.tracks.map((t) => t.key)).toEqual(["a", "b"]);
    expect(seen?.search.complete).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("deux observateurs de la même recherche : le curseur en attente (long-poll) n'est jamais annulé ni doublé", async () => {
    observers = 2;
    const signals: AbortSignal[] = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (!url.includes("cursor=c1")) return new Response(JSON.stringify(page([track("a", R1)], false, "c1")));
      if (init?.signal) signals.push(init.signal);
      await new Promise((r) => setTimeout(r, 60));
      return new Response(JSON.stringify(page([track("b", null)], true, null)));
    });
    vi.stubGlobal("fetch", fetchMock);
    await mount({ version: "1.32.0", capabilities: ["plugins.isolatedRuntime"] });
    await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("cursor=c1"))).toHaveLength(1);
    expect(signals.some((sig) => sig.aborted)).toBe(false);
    expect(seen?.search.tracks.map((t) => t.key)).toEqual(["a", "b"]);
  });

  it("une page suivante en échec : la recherche dit `failed` (plus rien ne viendra), sans erreur levée", async () => {
    const fetchMock = vi.fn(async (url: string) => (url.includes("cursor=c1") ? new Response("panne", { status: 502 }) : new Response(JSON.stringify({ ...page([track("a", R1)], false, "c1"), provisional: true, replace: true }))));
    vi.stubGlobal("fetch", fetchMock);
    await mount({ version: "1.32.0", capabilities: ["plugins.isolatedRuntime"] });
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    expect(seen?.search.failed).toBe(true);
    expect(seen?.search.pending).toBe(false);
    expect(seen?.search.provisional).toBe(true);
  });
});
