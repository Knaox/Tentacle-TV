/**
 * Un faux Jellyseerr pour Vigie : ses listes (découverte, tendances, recherche,
 * semblables, saga, filmographie) ne contiennent que de VRAIS identifiants TMDB —
 * ceux de la médiathèque du banc et des titres extérieurs du catalogue. Il ne
 * juge rien : c'est Vigie, par le pont du cœur, qui filtre ; le cœur relit les
 * classifications réelles chez TMDB. Les demandes reçues sont notées.
 */

import { createServer, type Server } from "node:http";
import { EXTERNALS, MOVIES, SERIES } from "./catalog";

export const SEERR_PORT = Number(process.env.PARENTAL_SEERR_PORT ?? 8916);

export interface SeerrTitle {
  id: number;
  mediaType: "movie" | "tv";
  name: string;
}

/** Tout ce que le faux connaît : la bibliothèque (y compris interdite) et l'extérieur. */
export const SEERR_TITLES: SeerrTitle[] = [
  ...MOVIES.map((m) => ({ id: m.tmdbId, mediaType: "movie" as const, name: m.title })),
  ...SERIES.map((s) => ({ id: s.tmdbId, mediaType: "tv" as const, name: s.title })),
  ...EXTERNALS.map((e) => ({ id: e.tmdbId, mediaType: e.mediaType, name: e.title })),
];

const card = (t: SeerrTitle) => ({
  id: t.id, mediaType: t.mediaType, posterPath: null, backdropPath: null, voteAverage: 7, voteCount: 100, popularity: 10,
  ...(t.mediaType === "movie" ? { title: t.name, originalTitle: t.name, releaseDate: "2000-01-01" } : { name: t.name, originalName: t.name, firstAirDate: "2000-01-01" }),
});

const page = (list: SeerrTitle[], n: number, size = 20) => ({
  page: n, totalPages: Math.max(1, Math.ceil(list.length / size)), totalResults: list.length,
  results: list.slice((n - 1) * size, n * size).map(card),
});

const of = (type: "movie" | "tv") => SEERR_TITLES.filter((t) => t.mediaType === type);
const find = (type: string, id: number) => SEERR_TITLES.find((t) => t.mediaType === type && t.id === id);

export interface FakeSeerr {
  url: string;
  /** Les demandes reçues — lues par HTTP, le faux pouvant vivre dans un autre processus (`--check`). */
  requestCount(): Promise<number>;
  close(): Promise<void>;
}

type Posted = Array<{ mediaType?: string; mediaId?: number }>;

/** Le faux d'un banc déjà en service (`run.ts --up`). */
export function remoteFakeSeerr(url: string): FakeSeerr {
  return {
    url,
    requestCount: async () => ((await (await fetch(`${url}/__requests`)).json()) as { count: number }).count,
    close: async () => undefined,
  };
}

function route(method: string, url: URL, body: string, posted: Posted): [number, unknown] {
  const p = url.pathname.replace(/\/+$/, "");
  const n = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  if (p === "/__requests") return [200, { count: posted.length }];
  if (p === "/api/v1/status") return [200, { version: "2.7.3", commitTag: "banc" }];
  if (p === "/api/v1/settings/main") return [200, { blocklistedTags: "", enableSpecialEpisodes: false, applicationTitle: "Banc" }];
  if (p === "/api/v1/settings/public") return [200, { initialized: true }];
  if (p.startsWith("/api/v1/discover/movies")) return [200, page(of("movie"), n)];
  if (p.startsWith("/api/v1/discover/tv")) return [200, page(of("tv"), n)];
  if (p === "/api/v1/discover/trending") return [200, page(SEERR_TITLES, n)];
  if (p === "/api/v1/search") {
    const query = (url.searchParams.get("query") ?? "").toLowerCase();
    return [200, page(SEERR_TITLES.filter((t) => t.name.toLowerCase().includes(query)), n)];
  }
  let m = /^\/api\/v1\/(movie|tv)\/(\d+)$/.exec(p);
  if (m) {
    const t = find(m[1], Number(m[2]));
    if (!t) return [404, { message: "inconnu du faux" }];
    return [200, {
      ...card(t), overview: `Résumé de ${t.name}`, keywords: [], genres: [], credits: { cast: [], crew: [] }, relatedVideos: [],
      ...(t.mediaType === "tv" ? { seasons: [1, 2, 3].map((s) => ({ id: t.id * 10 + s, seasonNumber: s, episodeCount: 2, name: `Saison ${s}` })), numberOfSeasons: 3 } : {}),
      mediaInfo: null,
    }];
  }
  m = /^\/api\/v1\/(movie|tv)\/(\d+)\/(similar|recommendations)$/.exec(p);
  if (m) return [200, page(of(m[1] as "movie" | "tv").filter((t) => t.id !== Number(m![2])), n)];
  m = /^\/api\/v1\/tv\/(\d+)\/season\/(\d+)$/.exec(p);
  if (m) return [200, { id: Number(m[1]) * 10 + Number(m[2]), seasonNumber: Number(m[2]), episodes: [1, 2].map((e) => ({ id: e, episodeNumber: e, seasonNumber: Number(m![2]), name: `Épisode ${e}` })) }];
  m = /^\/api\/v1\/collection\/(\d+)$/.exec(p);
  if (m) return [200, { id: Number(m[1]), name: "Saga du banc", parts: of("movie").slice(0, 12).map(card) }];
  m = /^\/api\/v1\/person\/(\d+)\/combined_credits$/.exec(p);
  if (m) return [200, { id: Number(m[1]), cast: SEERR_TITLES.map(card), crew: [] }];
  m = /^\/api\/v1\/person\/(\d+)$/.exec(p);
  if (m) return [200, { id: Number(m[1]), name: "Personne du banc", biography: "" }];
  if (p === "/api/v1/request" && method === "GET") return [200, { pageInfo: { pages: 0, pageSize: 50, results: 0, page: 1 }, results: [] }];
  if (p === "/api/v1/request" && method === "POST") {
    const parsed = JSON.parse(body || "{}") as { mediaType?: string; mediaId?: number };
    posted.push({ mediaType: parsed.mediaType, mediaId: parsed.mediaId });
    return [201, { id: 500 + posted.length, status: 2, media: { id: 70 + posted.length, tmdbId: parsed.mediaId, status: 3 } }];
  }
  if (p === "/api/v1/user" && method === "GET") return [200, { pageInfo: { pages: 0, results: 0 }, results: [] }];
  if (p.startsWith("/api/v1/media")) return [200, { pageInfo: { pages: 0, results: 0 }, results: [] }];
  return [404, { message: "absent du faux Jellyseerr" }];
}

export function startFakeSeerr(): Promise<FakeSeerr> {
  const requests: Posted = [];
  const server: Server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const [status, json] = route(req.method ?? "GET", new URL(req.url ?? "/", "http://banc"), body, requests);
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(json));
    });
  });
  return new Promise((ok) => server.listen(SEERR_PORT, "127.0.0.1", () => ok({
    url: `http://127.0.0.1:${SEERR_PORT}`,
    requestCount: async () => requests.length,
    close: () => new Promise((done) => server.close(() => done())),
  })));
}
