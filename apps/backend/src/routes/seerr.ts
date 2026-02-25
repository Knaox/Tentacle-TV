import type { FastifyPluginAsync } from "fastify";

const SEERR_URL = (process.env.SEERR_URL || "http://localhost:5055").replace(/\/$/, "");
const SEERR_API_KEY = process.env.SEERR_API_KEY || "";

const headers = { "X-Api-Key": SEERR_API_KEY };

async function proxyGet(path: string) {
  const res = await fetch(`${SEERR_URL}/api/v1${path}`, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw Object.assign(new Error(`Service error ${res.status}: ${text}`), { statusCode: res.status });
  }
  return res.json();
}

async function proxyPost(path: string, body: unknown) {
  const res = await fetch(`${SEERR_URL}/api/v1${path}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw Object.assign(new Error(`Service error ${res.status}: ${text}`), { statusCode: res.status });
  }
  return res.json();
}

async function proxyDelete(path: string) {
  const res = await fetch(`${SEERR_URL}/api/v1${path}`, { method: "DELETE", headers });
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

  // List requests
  app.get("/requests", async (req) => proxyGet(`/request?${qs(req.query)}`));

  // Request count
  app.get("/requests/count", async () => proxyGet("/request/count"));

  // Media list
  app.get("/media", async (req) => proxyGet(`/media?${qs(req.query)}`));

  // Movie / TV details
  app.get("/movie/:id", async (req) => proxyGet(`/movie/${(req.params as { id: string }).id}`));
  app.get("/tv/:id", async (req) => proxyGet(`/tv/${(req.params as { id: string }).id}`));
};
