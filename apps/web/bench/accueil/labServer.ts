/**
 * Le serveur FACTICE du banc de l'accueil : `window.fetch` répond à la place de Jellyfin et du
 * backend, depuis la bibliothèque du labo (`src/dev/accueilLab/labItems.ts`). Aucun réseau.
 *
 * Volontairement petit : ce que l'accueil, la barre et les cartes DEMANDENT, rien de plus. Une
 * adresse inconnue répond 404 et se note dans `window.__labUnhandled` — `capture.mjs` l'écrit,
 * pour qu'un écran qui dépend d'une route oubliée ne passe pas pour « vide ».
 */

import type { MediaItem } from "@tentacle-tv/shared";

import { LAB_EPISODES, LAB_MOVIES, LAB_ROWS, LAB_SERIES, labItem, labItems } from "../../src/dev/accueilLab/labItems";

export const LAB_USER = { Id: "lab-user", Name: "Knaoxtest", Policy: { IsAdministrator: false } };

export interface LabServerOptions {
  /** Nombre de bibliothèques de la barre (3 par défaut ; 20 pour l'épreuve du débordement). */
  libraries: number;
  /** `empty` : un serveur sans titre ; `error` : tout échoue (500) ; `slow` : rien ne répond. */
  state: "ok" | "empty" | "error" | "slow";
}

const EXTRA_LIBRARIES = [
  "Documentaires", "Animés", "Concerts", "Spectacles", "Courts métrages", "Jeunesse", "Classiques", "Films 4K",
  "Séries terminées", "Cinéma d'auteur", "Science-fiction", "Westerns", "Films muets", "Archives", "Sport",
  "Karaoké", "Théâtre",
];

function libraries(count: number) {
  const base = [
    { Id: "lib-movies", Name: "Films", CollectionType: "movies" },
    { Id: "lib-shows", Name: "Séries", CollectionType: "tvshows" },
    { Id: "lib-anim", Name: "Animation", CollectionType: "movies" },
  ];
  const extra = EXTRA_LIBRARIES.map((Name, i) => ({ Id: `lib-x${i}`, Name, CollectionType: i % 3 === 1 ? "tvshows" : "movies" }));
  return [...base, ...extra].slice(0, count).map((lib) => ({ ...lib, Type: "CollectionFolder", ImageTags: {} }));
}

const ALL: MediaItem[] = [...LAB_MOVIES, LAB_SERIES, ...LAB_EPISODES];
const page = (items: MediaItem[]) => ({ Items: items, TotalRecordCount: items.length, StartIndex: 0 });

function queryItems(params: URLSearchParams): MediaItem[] {
  let items = ALL;
  const ids = params.get("Ids") ?? params.get("ids");
  if (ids) return ids.split(",").flatMap((id) => ALL.filter((item) => item.Id === id));
  const types = (params.get("IncludeItemTypes") ?? params.get("includeItemTypes"))?.split(",");
  if (types) items = items.filter((item) => types.includes(item.Type));
  else items = items.filter((item) => item.Type !== "Episode");
  const parent = params.get("ParentId") ?? params.get("parentId");
  if (parent === "lib-shows") items = items.filter((item) => item.Type === "Series");
  else if (parent?.startsWith("lib-")) items = items.filter((item) => item.Type === "Movie");
  const filters = params.get("Filters") ?? "";
  if (filters.includes("IsFavorite") || params.get("IsFavorite") === "true") items = items.filter((item) => item.UserData?.IsFavorite);
  if (filters.includes("Likes")) items = items.filter((item) => item.UserData?.Likes);
  if (filters.includes("IsPlayed")) items = items.filter((item) => item.UserData?.Played);
  if (filters.includes("IsResumable")) items = labItems(...LAB_ROWS.resume);
  const term = (params.get("SearchTerm") ?? params.get("searchTerm"))?.toLowerCase();
  if (term) items = items.filter((item) => item.Name.toLowerCase().includes(term));
  const limit = Number(params.get("Limit") ?? params.get("limit") ?? 0);
  return limit > 0 ? items.slice(0, limit) : items;
}

type Answer = { status?: number; body: unknown } | null;

function jellyfin(path: string, params: URLSearchParams, options: LabServerOptions): Answer {
  const empty = options.state === "empty";
  if (/^\/Users\/[^/]+\/Views$/.test(path) || path === "/UserViews") return { body: { Items: libraries(options.libraries) } };
  if (/^\/Users\/[^/]+$/.test(path) || path === "/Users/Me") return { body: LAB_USER };
  if (/\/Items\/Resume$/.test(path)) return { body: page(empty ? [] : labItems(...LAB_ROWS.resume)) };
  if (path === "/Shows/NextUp") return { body: page(empty ? [] : labItems("cam2")) };
  if (/\/Items\/Latest$/.test(path)) {
    if (empty) return { body: [] };
    const parent = params.get("ParentId") ?? params.get("parentId");
    if (parent === "lib-shows") return { body: [LAB_SERIES] };
    return { body: labItems(...(parent === "lib-anim" ? LAB_ROWS.sciFi : parent === "lib-movies" ? LAB_ROWS.latestMovies : LAB_ROWS.classics)) };
  }
  const single = /\/Items\/([^/]+)$/.exec(path);
  if (single && !["Resume", "Latest", "Filters", "Counts"].includes(single[1])) {
    try {
      return { body: labItem(single[1]) };
    } catch {
      return { status: 404, body: {} };
    }
  }
  if (/\/Items$/.test(path)) return { body: page(empty ? [] : queryItems(params)) };
  if (/^\/Shows\/[^/]+\/Episodes$/.test(path)) return { body: page(LAB_EPISODES) };
  if (/\/Similar$/.test(path)) return { body: page(labItems(...LAB_ROWS.sciFi)) };
  if (path === "/Items/Counts") return { body: { MovieCount: empty ? 0 : LAB_MOVIES.length, SeriesCount: empty ? 0 : 1, EpisodeCount: empty ? 0 : 3 } };
  if (path === "/System/Info/Public") return { body: { Id: "lab-server", Version: "10.11.0", ServerName: "Labo" } };
  if (path === "/Sessions" || path === "/Sessions/Capabilities/Full") return { body: [] };
  return null;
}

const CAPABILITIES = ["jellyfin.health", "home.heroRecoKinds", "account.abilities", "rights.live", "watchTogether.access", "notifications.paging"];

function backend(path: string, options: LabServerOptions): Answer {
  if (path === "/api/config") return { body: { version: "1.41.0", brandName: "Tentacle TV", features: { downloads: false, demo: false }, capabilities: CAPABILITIES } };
  if (path === "/api/preferences/home-layout") {
    const libs = libraries(options.libraries).slice(0, 3);
    const rows = [
      { key: "resume", enabled: true },
      { key: "nextUp", enabled: true },
      ...libs.map((lib) => ({ key: `library:${lib.Id}`, enabled: true })),
      { key: "watchlist", enabled: true },
    ];
    return { body: { stored: false, layout: { heroMode: "resume", heroFixedItemId: null, rows, cardDensity: "normal" }, catalog: rows } };
  }
  if (path === "/api/plugins/active") return { body: [] };
  if (path === "/api/health") return { body: { status: "ok", jellyfin: "ok" } };
  if (path === "/api/account/abilities") {
    return { body: { session: "personal", administrator: false, playback: true, keepOffline: false, watchTogether: "full", publicSharing: true, deleteTitles: false, tickets: true, extensions: true, manageAccount: true, pairDevices: true, push: false, invites: false } };
  }
  if (path === "/api/watch-together/access") return { body: { access: "full" } };
  if (path === "/api/preferences/reco") {
    return { body: { stored: false, settings: { personalized: true, includeVigie: false, community: true, shareHistory: true, explorationBalance: 0.5, providerFilter: [], trendingNow: true } } };
  }
  if (path.startsWith("/api/notifications")) return { body: { notifications: [], unreadCount: 0, items: [], total: 0 } };
  if (path.startsWith("/api/watchlist")) return { body: { items: labItems("charade", "spring").map((item) => ({ itemId: item.Id })), ids: ["charade", "spring"] } };
  if (path.startsWith("/api/ratings")) return { body: { ratings: [{ tmdbId: 1, mediaType: "movie", score: 9, jellyfinItemId: "vertigo" }] } };
  return null;
}

declare global {
  interface Window {
    __labUnhandled?: string[];
  }
}

export function installLabServer(options: LabServerOptions): void {
  const unhandled: string[] = [];
  window.__labUnhandled = unhandled;
  const real = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.href);
    if (!url.pathname.startsWith("/api/")) return real(input, init);
    if (options.state === "slow") return new Promise<Response>(() => undefined);
    if (options.state === "error" && url.pathname !== "/api/config") return new Response("{}", { status: 500 });
    const method = init?.method ?? "GET";
    const answer = url.pathname.startsWith("/api/jellyfin/")
      ? jellyfin(url.pathname.slice("/api/jellyfin".length), url.searchParams, options)
      : backend(url.pathname, options);
    if (method !== "GET" && answer === null) return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    if (answer === null) {
      const line = `${method} ${url.pathname}${url.search}`;
      if (!unhandled.includes(line)) unhandled.push(line);
      return new Response("{}", { status: 404, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200, headers: { "content-type": "application/json" } });
  };
}
