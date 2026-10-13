/**
 * Le crochet de la visite, monté pour de vrai (React, TanStack, sans DOM) :
 * la page servie change dans le cache — `reco:update`, refetch, refus —, et
 * l'écran ne prend que ce que la règle 5 lui permet (docs/RECO-POUR-VOUS.md).
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecoRowItem } from "../hooks/recoTypes";
import { RECO_PAGE_KEY, dropRecoItemEverywhere, type RecoPage } from "../hooks/useRecoPage";
import { RECO_ARRIVAL_MS } from "./recoPageVisit";
import { RECO_LEAVE_MS, releaseRecoCard } from "./recoRetirement";
import { holdRecoCard, resetRecoRetirementForTests } from "./recoRetirementState";
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

const item = (key: string): RecoRowItem => ({
  key, mediaType: "movie", tmdbId: Number(key.split(":")[1]), title: key, year: null, posterPath: null,
  jellyfinItemId: null, source: "x", score: 1, voteAverage: null, reasons: [],
});

const page = (rows: Record<string, string[]>, over: Partial<RecoPage> = {}): RecoPage => ({
  state: "ready", signalCount: 20, generating: false, refining: false, exploring: false, generatedAt: null,
  poolGeneratedAt: null, tmdbConfigured: true, personalized: true, filter: null,
  rows: Object.entries(rows).map(([key, keys]) => ({ key, items: keys.map(item) })),
  ...over,
});

// La page de l'arrivée, puis la page que le serveur recalcule après un refus.
const A = page({ forYou: ["movie:1", "movie:2", "movie:3"], "becauseYouLiked:movie:9": ["movie:4", "movie:5"] });
const B = page({ forYou: ["movie:1", "movie:7"], "becauseYouLiked:movie:8": ["movie:6"] });

let qc: QueryClient;
let roots: Root[] = [];
let probe: RecoPageVisit;

function Rig() {
  probe = useRecoPageVisit(null);
  return null;
}

const shownKeys = () => probe.data?.rows.map((row) => `${row.key}=${row.items.map((i) => i.key).join(",")}`);

async function mount(initial: RecoPage | null = A) {
  if (initial) qc.setQueryData([RECO_PAGE_KEY, "all"], initial);
  const root = createRoot(container as never);
  roots.push(root);
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client: qc }, createElement(Rig)));
  });
}

async function unmountAll() {
  const mounted = roots;
  roots = [];
  for (const root of mounted) await act(async () => root.unmount());
}

// TanStack prévient ses observateurs au tour suivant de la boucle (`notifyManager`).
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Le serveur sert une autre page (le socket, un refetch) — le cache la reçoit. */
async function serve(next: RecoPage) {
  await act(async () => {
    qc.setQueryData([RECO_PAGE_KEY, "all"], next);
    await settle();
  });
}

/** Un titre sort des pages en cache (refus, jugé puis lâché, noté). */
async function drop(key: string) {
  await act(async () => {
    await dropRecoItemEverywhere(qc, key);
    await settle();
  });
}

const leaveArrival = () => vi.setSystemTime(Date.now() + RECO_ARRIVAL_MS + 1);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  resetRecoRetirementForTests();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(async () => {
  await unmountAll();
  qc.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useRecoPageVisit — une page servie reste à l'écran tant qu'on y est", () => {
  it("une page recalculée en pleine visite ATTEND : l'écran garde la sienne, une invitation discrète paraît", async () => {
    await mount();
    leaveArrival();
    await serve(B);
    expect(shownKeys()).toEqual(["forYou=movie:1,movie:2,movie:3", "becauseYouLiked:movie:9=movie:4,movie:5"]);
    expect(probe.hasNewer).toBe(true);
  });

  it("le titre refusé s'en va seul — même quand le cache tient déjà une autre page", async () => {
    await mount();
    leaveArrival();
    await serve(B);
    await drop("movie:2");
    expect(shownKeys()).toEqual(["forYou=movie:1,movie:3", "becauseYouLiked:movie:9=movie:4,movie:5"]);
    // Le dernier titre d'une rangée parti, la rangée part avec lui.
    await drop("movie:4");
    await drop("movie:5");
    expect(shownKeys()).toEqual(["forYou=movie:1,movie:3"]);
  });

  it("une page qui ne fait que retirer (le refetch d'après un refus) n'invite à rien", async () => {
    await mount();
    leaveArrival();
    await drop("movie:3");
    await serve(page({ forYou: ["movie:1", "movie:2"], "becauseYouLiked:movie:9": ["movie:4", "movie:5"] }));
    expect(shownKeys()).toEqual(["forYou=movie:1,movie:2", "becauseYouLiked:movie:9=movie:4,movie:5"]);
    expect(probe.hasNewer).toBe(false);
  });

  it("le geste explicite affiche la page recalculée", async () => {
    await mount();
    leaveArrival();
    await serve(B);
    await act(async () => probe.showNewer());
    expect(shownKeys()).toEqual(["forYou=movie:1,movie:7", "becauseYouLiked:movie:8=movie:6"]);
    expect(probe.hasNewer).toBe(false);
  });

  it("à l'arrivée, la page fraîche remplace celle du cache", async () => {
    await mount();
    await serve(B);
    expect(shownKeys()).toEqual(["forYou=movie:1,movie:7", "becauseYouLiked:movie:8=movie:6"]);
  });

  it("une page encore sans rien de personnel laisse entrer la première page personnelle", async () => {
    await mount(page({ trending: ["movie:10"] }, { state: "cold", refining: true }));
    leaveArrival();
    await serve(A);
    expect(shownKeys()?.[0]).toBe("forYou=movie:1,movie:2,movie:3");
  });

  it("réessayer ou tirer pour rafraîchir : la page relue s'affiche", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => B }));
    await mount();
    leaveArrival();
    await act(async () => {
      await probe.refetch();
    });
    expect(shownKeys()).toEqual(["forYou=movie:1,movie:7", "becauseYouLiked:movie:8=movie:6"]);
  });

  it("une carte jugée part AU LÂCHER, même quand le serveur l'a déjà retirée de sa page", async () => {
    // Le film « movie:1 » est en bibliothèque (m1) ; sa rangée est survolée.
    const withLibrary = page({ forYou: ["movie:1", "movie:2"] });
    withLibrary.rows[0].items[0] = { ...withLibrary.rows[0].items[0], jellyfinItemId: "m1" };
    await mount(withLibrary);
    leaveArrival();
    holdRecoCard("movie:1");
    // Marqué vu (le plateau patche la fiche), puis le serveur ressert sa page SANS lui.
    qc.setQueryData(["item", "m1"], {
      Id: "m1", Name: "Film", Type: "Movie",
      UserData: { Played: true, PlayedPercentage: 100, PlaybackPositionTicks: 0, PlayCount: 1, IsFavorite: false },
    });
    await serve(page({ forYou: ["movie:2", "movie:9"] }));
    expect(shownKeys()).toEqual(["forYou=movie:1,movie:2"]);
    // Le pointeur quitte la rangée : le fondu, puis le retrait — de l'écran aussi.
    await act(async () => {
      releaseRecoCard(qc, "movie:1");
      await new Promise((resolve) => setTimeout(resolve, RECO_LEAVE_MS + 40));
      await settle();
    });
    expect(shownKeys()).toEqual(["forYou=movie:2"]);
  });

  it("la visite suivante lit la page du moment", async () => {
    await mount();
    leaveArrival();
    await serve(B);
    await unmountAll();
    await mount(null);
    expect(shownKeys()).toEqual(["forYou=movie:1,movie:7", "becauseYouLiked:movie:8=movie:6"]);
  });
});
