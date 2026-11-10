/**
 * Défaut C du relevé, monté pour de vrai (React, TanStack, sans DOM) : la
 * bascule d'une carte répond AU CLIC, avant le serveur — y compris sur une
 * carte de recommandation, dont l'item n'a ni `UserData` ni fiche en cache, et
 * sur une série dont l'ensemble « Ma liste » n'est pas chargé.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";

interface Call {
  path: string;
  method: string;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}
const server = vi.hoisted(() => ({ calls: [] as Call[] }));

vi.mock("./useJellyfinClient", () => ({
  useJellyfinClient: () => ({
    fetch: (path: string, init?: { method?: string }) =>
      new Promise((resolve, reject) => {
        server.calls.push({ path, method: init?.method ?? "GET", resolve, reject });
      }),
  }),
}));
vi.mock("./useUserId", () => ({ useUserId: () => "moi" }));
vi.mock("./watchlistAutoRetired", () => ({ forgetAutoRetired: async () => undefined, recordAutoRetired: async () => undefined, tentacleBackend: {} }));

import { resetPendingUserDataForTests } from "./pendingUserData";
import { useCardMarkers } from "./useCardMarkers";
import { useCardToggles, type CardToggles } from "./useCardToggles";
import { useBatchWatchedToggle } from "./useBatchWatchedToggle";

const g = globalThis as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.window ??= globalThis;
const doc: Record<string, unknown> = { nodeType: 9, activeElement: null, addEventListener() {}, removeEventListener() {} };
doc.defaultView = { document: doc, HTMLIFrameElement: class {} };
const container = {
  nodeType: 1, tagName: "DIV", nodeName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml",
  ownerDocument: doc, addEventListener() {}, removeEventListener() {},
};

let qc: QueryClient;
let root: Root | null = null;
let toggles: CardToggles;
let statuses: string[] = [];

function Rig({ item }: { item: MediaItem }) {
  toggles = useCardToggles(item);
  // La pastille au repos de la MÊME carte.
  statuses = useCardMarkers(item, { communityRating: null }).statuses;
  return null;
}

async function mount(item: MediaItem) {
  root = createRoot(container as never);
  await act(async () => {
    root?.render(createElement(QueryClientProvider, { client: qc }, createElement(Rig, { item })));
  });
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const flush = async () => { await act(async () => { await tick(); await tick(); }); };
const pendingCall = (method: string, part: string) =>
  server.calls.find((call) => call.method === method && call.path.includes(part));
/** Répond aux lectures en attente (ensembles de séries, notes) — jamais à la mutation. */
async function answerReads(value: unknown) {
  for (const call of server.calls.filter((entry) => entry.method === "GET")) call.resolve(value);
  await flush();
}

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  server.calls = [];
  resetPendingUserDataForTests();
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  qc.clear();
});

describe("la bascule répond au clic", () => {
  // Le visage d'une recommandation en bibliothèque : ni `UserData`, ni fiche en cache.
  const recoFace = { Id: "m1", Type: "Movie", Name: "Matrix", ProviderIds: { Tmdb: "603" } } as unknown as MediaItem;

  it("« vu » sur une carte de recommandation, avant la réponse du serveur", async () => {
    await mount(recoFace);
    expect(toggles.watched).toBe(false);

    await act(async () => { toggles.toggleWatched(); await tick(); });
    const post = pendingCall("POST", "/PlayedItems/m1");
    expect(post).toBeDefined();
    // Le serveur n'a PAS répondu : la carte dit déjà « vu », plateau et pastille.
    expect(toggles.watched).toBe(true);
    expect(statuses).toContain("watched");

    // Il confirme : la fiche est demandée, et l'état ne retombe pas entre les deux.
    post?.resolve({});
    await flush();
    expect(toggles.watched).toBe(true);
    const detail = pendingCall("GET", "/Items/m1?");
    expect(detail).toBeDefined();
    detail?.resolve({ ...recoFace, UserData: { Played: true, PlayCount: 1, IsFavorite: false, PlaybackPositionTicks: 0 } });
    await flush();
    expect(qc.getQueryData<MediaItem>(["item", "m1"])?.UserData?.Played).toBe(true);
  });

  it("un refus du serveur défait le geste", async () => {
    await mount(recoFace);
    await act(async () => { toggles.toggleFavorite(); await tick(); });
    expect(toggles.favorite).toBe(true);
    pendingCall("POST", "/FavoriteItems/m1")?.reject(new Error("500"));
    await flush();
    expect(toggles.favorite).toBe(false);
    expect(statuses).not.toContain("favorite");
  });

  it("Ma liste sur une série dont l'ensemble n'est pas encore chargé", async () => {
    const series = { Id: "s1", Type: "Series", Name: "Arcane" } as unknown as MediaItem;
    await mount(series);
    // Les ensembles de séries sont en route : rien n'est en cache.
    expect(toggles.watchlist).toBe(false);

    await act(async () => { toggles.toggleList(); await tick(); });
    expect(pendingCall("POST", "/Items/s1/Rating")).toBeDefined();
    expect(toggles.watchlist).toBe(true);
    expect(statuses).toContain("watchlist");

    // Le serveur confirme, l'ensemble arrive avec la série : l'état reste.
    pendingCall("POST", "/Items/s1/Rating")?.resolve({});
    await flush();
    await answerReads({ Items: [{ Id: "s1" }] });
    await flush();
    expect(toggles.watchlist).toBe(true);
  });
});

describe("marquer une saison entière", () => {
  let batch: ReturnType<typeof useBatchWatchedToggle>;
  function SeasonRig() {
    batch = useBatchWatchedToggle({ seriesId: "s1", seasonId: "sa1" });
    return null;
  }
  const episode = (Id: string) =>
    ({ Id, Type: "Episode", SeriesId: "s1", UserData: { Played: false, PlayCount: 0, IsFavorite: false, PlaybackPositionTicks: 0 } }) as MediaItem;

  it("les épisodes passent « vus » au clic, avant les réponses du serveur", async () => {
    qc.setQueryData(["episodes", "s1", "sa1"], [episode("e1"), episode("e2"), episode("e3")]);
    root = createRoot(container as never);
    await act(async () => {
      root?.render(createElement(QueryClientProvider, { client: qc }, createElement(SeasonRig)));
    });

    await act(async () => { batch.markWatched.mutate(["e1", "e2"]); await tick(); await tick(); });
    expect(server.calls.filter((call) => call.method === "POST")).toHaveLength(2);
    // Aucune réponse encore : la liste dit déjà vu, vu, pas vu.
    expect(qc.getQueryData<MediaItem[]>(["episodes", "s1", "sa1"])?.map((item) => item.UserData?.Played)).toEqual([true, true, false]);
  });
});
