import type { FastifyPluginAsync } from "fastify";
import { getSeerrUrl, getSeerrApiKey } from "../services/configStore";

function seerrHeaders() { return { "X-Api-Key": getSeerrApiKey() || "" }; }
function seerrBase() { return (getSeerrUrl() || "").replace(/\/$/, ""); }

async function proxyGet(path: string) {
  const res = await fetch(`${seerrBase()}/api/v1${path}`, { headers: seerrHeaders() });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw Object.assign(new Error(`Service error ${res.status}: ${text}`), { statusCode: res.status });
  }
  return res.json();
}

async function proxyPost(path: string, body: unknown) {
  const res = await fetch(`${seerrBase()}/api/v1${path}`, {
    method: "POST",
    headers: { ...seerrHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw Object.assign(new Error(`Service error ${res.status}: ${text}`), { statusCode: res.status });
  }
  return res.json();
}

async function proxyDelete(path: string) {
  const res = await fetch(`${seerrBase()}/api/v1${path}`, { method: "DELETE", headers: seerrHeaders() });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw Object.assign(new Error(`Service error ${res.status}: ${text}`), { statusCode: res.status });
  }
  // DELETE may return 204 No Content
  if (res.status === 204) return { success: true };
  return res.json().catch(() => ({ success: true }));
}

function qs(query: unknown): string {
  return new URLSearchParams(query as Record<string, string>).toString();
}

// Rate limit: 15 seconds between requests per IP
let lastRequestTime = 0;
const REQUEST_COOLDOWN = 15_000;

export const seerrRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onError", (_req, reply, error) => {
    const status = (error as { statusCode?: number }).statusCode || 502;
    reply.status(status).send({ message: error.message });
  });

  // Search — manually construct URL to avoid encoding issues
  app.get("/search", async (req, reply) => {
    const query = req.query as Record<string, string>;
    const q = query.query;
    if (!q) return reply.status(400).send({ message: "query required" });
    const page = query.page || "1";
    const language = query.language || "en";
    return proxyGet(`/search?query=${encodeURIComponent(q)}&page=${page}&language=${language}`);
  });

  // Discover
  app.get("/discover/movies", async (req) => {
    const query = req.query as Record<string, string>;
    const page = query.page || "1";
    const language = query.language || "en";
    return proxyGet(`/discover/movies?page=${page}&language=${language}`);
  });
  app.get("/discover/tv", async (req) => {
    const query = req.query as Record<string, string>;
    const page = query.page || "1";
    const language = query.language || "en";
    return proxyGet(`/discover/tv?page=${page}&language=${language}`);
  });
  app.get("/discover/anime", async (req) => {
    const query = req.query as Record<string, string>;
    const page = query.page || "1";
    const language = query.language || "en";
    return proxyGet(`/discover/tv?page=${page}&language=${language}&keywords=210024`);
  });
  app.get("/discover/trending", async (req) => {
    const query = req.query as Record<string, string>;
    const page = query.page || "1";
    const language = query.language || "en";
    return proxyGet(`/discover/trending?page=${page}&language=${language}`);
  });

  // Create a request (with 15s cooldown)
  app.post("/request", async (req, reply) => {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < REQUEST_COOLDOWN) {
      const wait = Math.ceil((REQUEST_COOLDOWN - elapsed) / 1000);
      return reply.status(429).send({ message: `Veuillez attendre ${wait}s avant une nouvelle demande` });
    }
    lastRequestTime = now;
    return proxyPost("/request", req.body);
  });

  // Delete a request (cancels in Sonarr/Radarr via Seerr)
  app.delete("/request/:id", async (req) => {
    const { id } = req.params as { id: string };
    return proxyDelete(`/request/${id}`);
  });

  // List requests (raw Seerr response)
  app.get("/requests", async (req) => proxyGet(`/request?${qs(req.query)}`));

  // Enriched requests — adds title + posterPath from TMDB via Seerr
  app.get("/requests/enriched", async (req) => {
    const data = await proxyGet(`/request?${qs(req.query)}`) as {
      pageInfo: { pages: number; results: number; page: number; pageSize: number };
      results: Array<{
        id: number; type: string; status: number;
        createdAt: string; updatedAt: string;
        media: { tmdbId: number; mediaType: string; status: number };
        requestedBy: { displayName?: string; username?: string; jellyfinUserId?: string };
        seasons?: Array<{ seasonNumber: number; status: number }>;
      }>;
    };

    // Collect unique media items to fetch details for
    const mediaKeys = new Map<string, { mediaType: string; tmdbId: number }>();
    for (const r of data.results) {
      const key = `${r.media.mediaType}:${r.media.tmdbId}`;
      if (!mediaKeys.has(key)) mediaKeys.set(key, { mediaType: r.media.mediaType, tmdbId: r.media.tmdbId });
    }

    // Fetch media details in parallel (title + posterPath)
    const mediaDetails = new Map<string, { title: string; posterPath: string | null }>();
    await Promise.allSettled(
      [...mediaKeys.entries()].map(async ([key, { mediaType, tmdbId }]) => {
        try {
          const endpoint = mediaType === "movie" ? "movie" : "tv";
          const detail = await proxyGet(`/${endpoint}/${tmdbId}`) as {
            title?: string; name?: string; posterPath?: string;
          };
          mediaDetails.set(key, {
            title: detail.title || detail.name || `TMDB #${tmdbId}`,
            posterPath: detail.posterPath || null,
          });
        } catch { /* skip — will show fallback */ }
      })
    );

    // Map Seerr status codes to labels
    const mapStatus = (reqStatus: number, mediaStatus: number): string => {
      if (mediaStatus >= 5) return "available";
      switch (reqStatus) {
        case 1: return "pending";
        case 2: return "approved";
        case 3: return "declined";
        default: return "submitted";
      }
    };

    const enriched = data.results.map((r) => {
      const key = `${r.media.mediaType}:${r.media.tmdbId}`;
      const detail = mediaDetails.get(key);
      return {
        id: r.id,
        username: r.requestedBy.displayName || r.requestedBy.username || "Inconnu",
        mediaType: r.media.mediaType,
        tmdbId: r.media.tmdbId,
        title: detail?.title || `#${r.media.tmdbId}`,
        posterPath: detail?.posterPath || null,
        status: mapStatus(r.status, r.media.status),
        seerrRequestId: r.id,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });

    return {
      results: enriched,
      total: data.pageInfo.results,
      page: data.pageInfo.page,
      totalPages: data.pageInfo.pages,
    };
  });

  // Request count
  app.get("/requests/count", async () => proxyGet("/request/count"));

  // Media list
  app.get("/media", async (req) => proxyGet(`/media?${qs(req.query)}`));

  // Movie / TV details
  app.get("/movie/:id", async (req) => proxyGet(`/movie/${(req.params as { id: string }).id}`));
  app.get("/tv/:id", async (req) => proxyGet(`/tv/${(req.params as { id: string }).id}`));
};
