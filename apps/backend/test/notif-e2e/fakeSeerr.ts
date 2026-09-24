/**
 * Le faux Jellyseerr du banc : les utilisateurs liés à Jellyfin, les fiches
 * `movie`/`tv` avec leur `mediaInfo`, la création et le suivi des demandes.
 * Le banc fait avancer l'état d'un média à la main — « en cours » puis
 * « disponible » — comme Jellyseerr après ses scans. Le reste reçoit une
 * réponse vide, compté dans `unknown`.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export const SEERR_API_KEY = "bench-seerr-key";

/** Statuts Jellyseerr d'un média : 3 en cours, 4 en partie, 5 disponible. */
export const PROCESSING = 3;
export const PARTIALLY_AVAILABLE = 4;
export const AVAILABLE = 5;

interface Media {
  id: number;
  tmdbId: number;
  mediaType: "movie" | "tv";
  status: number;
  seasons: Array<{ seasonNumber: number; status: number }>;
  downloading: boolean;
}

export interface SeerrRequest {
  id: number;
  mediaKey: string;
  userId: number;
  seasons: number[];
}

export class FakeSeerr {
  readonly media = new Map<string, Media>();
  readonly requests = new Map<number, SeerrRequest>();
  readonly unknown = new Map<string, number>();
  private nextId = 100;
  private server: Server | null = null;

  constructor(readonly users: Array<{ id: number; jellyfinUserId: string; username: string }>) {}

  async start(): Promise<string> {
    this.server = createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((ok) => this.server!.listen(0, "127.0.0.1", ok));
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((ok) => this.server?.close(() => ok()) ?? ok());
  }

  requestsFor(mediaType: "movie" | "tv", tmdbId: number): SeerrRequest[] {
    return [...this.requests.values()].filter((r) => r.mediaKey === `${mediaType}:${tmdbId}`);
  }

  /** « Jellyseerr voit enfin le contenu » : disponible (film, ou les saisons données). */
  markAvailable(mediaType: "movie" | "tv", tmdbId: number, seasons: number[] = []): void {
    const m = this.ensureMedia(mediaType, tmdbId);
    m.downloading = false;
    for (const s of seasons) {
      const row = m.seasons.find((x) => x.seasonNumber === s);
      if (row) row.status = AVAILABLE;
      else m.seasons.push({ seasonNumber: s, status: AVAILABLE });
    }
    m.status = mediaType === "movie" || m.seasons.every((s) => s.status === AVAILABLE) ? AVAILABLE : PARTIALLY_AVAILABLE;
  }

  /** Un téléchargement actif dans la file *arr. */
  markDownloading(mediaType: "movie" | "tv", tmdbId: number): void {
    const m = this.ensureMedia(mediaType, tmdbId);
    m.status = PROCESSING;
    m.downloading = true;
  }

  private ensureMedia(mediaType: "movie" | "tv", tmdbId: number): Media {
    const key = `${mediaType}:${tmdbId}`;
    let m = this.media.get(key);
    if (!m) {
      m = { id: this.nextId++, tmdbId, mediaType, status: 1, seasons: [], downloading: false };
      this.media.set(key, m);
    }
    return m;
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://fake");
    const path = url.pathname.replace(/\/+$/, "");
    const send = (status: number, body: unknown): void => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.headers["x-api-key"] !== SEERR_API_KEY) return send(401, { message: "Unauthorized" });

    if (path === "/api/v1/user" && req.method === "GET") {
      return send(200, { pageInfo: { pages: 1, page: 1, results: this.users.length }, results: this.users });
    }
    const detail = /^\/api\/v1\/(movie|tv)\/(\d+)$/.exec(path);
    if (detail && req.method === "GET") return send(200, this.detailDto(detail[1] as "movie" | "tv", Number(detail[2])));
    if (path === "/api/v1/request" && req.method === "POST") {
      const body = JSON.parse(await readBody(req)) as { mediaType: "movie" | "tv"; mediaId: number; userId: number; seasons?: number[] };
      const m = this.ensureMedia(body.mediaType, body.mediaId);
      if (m.status < PROCESSING) m.status = PROCESSING;
      const request: SeerrRequest = { id: this.nextId++, mediaKey: `${body.mediaType}:${body.mediaId}`, userId: body.userId, seasons: body.seasons ?? [] };
      this.requests.set(request.id, request);
      for (const s of request.seasons) {
        if (!m.seasons.some((x) => x.seasonNumber === s)) m.seasons.push({ seasonNumber: s, status: PROCESSING });
      }
      return send(201, { id: request.id, status: 2, media: { id: m.id, status: m.status } });
    }
    const one = /^\/api\/v1\/request\/(\d+)$/.exec(path);
    if (one && req.method === "GET") {
      const r = this.requests.get(Number(one[1]));
      if (!r) return send(404, { message: "Not found" });
      const m = this.media.get(r.mediaKey)!;
      const downloadStatus = m.downloading ? [{ externalId: 1, status: "downloading", title: "bench" }] : [];
      return send(200, { id: r.id, status: 2, media: { id: m.id, status: m.status, downloadStatus } });
    }
    if (path === "/api/v1/request" && req.method === "GET") {
      return send(200, { pageInfo: { pages: 1, page: 1, results: 0 }, results: [] });
    }
    if (/^\/api\/v1\/settings\/jobs\/[^/]+\/run$/.test(path)) return send(200, {});
    if (path === "/api/v1/status") return send(200, { version: "2.7.0" });

    this.unknown.set(`${req.method} ${path}`, (this.unknown.get(`${req.method} ${path}`) ?? 0) + 1);
    return send(200, { pageInfo: { pages: 0, page: 1, results: 0 }, results: [] });
  }

  private detailDto(mediaType: "movie" | "tv", tmdbId: number): Record<string, unknown> {
    const m = this.media.get(`${mediaType}:${tmdbId}`);
    const mediaInfo = m
      ? { id: m.id, tmdbId, status: m.status, seasons: m.seasons, requests: [], downloadStatus: [] }
      : undefined;
    return { id: tmdbId, keywords: [], mediaInfo, ...(mediaType === "tv" ? { seasons: [{ seasonNumber: 1 }] } : {}) };
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((ok, fail) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => ok(Buffer.concat(chunks).toString("utf8")));
    req.on("error", fail);
  });
}
