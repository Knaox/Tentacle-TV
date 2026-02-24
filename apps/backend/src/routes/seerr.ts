import type { FastifyPluginAsync } from "fastify";

const SEERR_URL = (process.env.SEERR_URL || "http://localhost:5055").replace(/\/$/, "");
const SEERR_API_KEY = process.env.SEERR_API_KEY || "";

async function proxyGet(path: string) {
  const res = await fetch(`${SEERR_URL}/api/v1${path}`, {
    headers: { "X-Api-Key": SEERR_API_KEY },
  });
  if (!res.ok) throw new Error(`Seerr ${res.status}: ${res.statusText}`);
  return res.json();
}

async function proxyPost(path: string, body: unknown) {
  const res = await fetch(`${SEERR_URL}/api/v1${path}`, {
    method: "POST",
    headers: { "X-Api-Key": SEERR_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Seerr ${res.status}: ${res.statusText}`);
  return res.json();
}

export const seerrRoutes: FastifyPluginAsync = async (app) => {
  // Search (proxied to Seerr which uses TMDB)
  app.get<{ Querystring: { query: string; page?: string } }>("/search", async (request, reply) => {
    const { query, page } = request.query;
    if (!query) return reply.status(400).send({ message: "query required" });
    const data = await proxyGet(`/search?query=${encodeURIComponent(query)}&page=${page || "1"}`);
    return data;
  });

  // Movie details
  app.get<{ Params: { id: string } }>("/movie/:id", async (request) => {
    return proxyGet(`/movie/${request.params.id}`);
  });

  // TV details
  app.get<{ Params: { id: string } }>("/tv/:id", async (request) => {
    return proxyGet(`/tv/${request.params.id}`);
  });

  // Create a request
  app.post("/request", async (request) => {
    return proxyPost("/request", request.body);
  });

  // List requests
  app.get("/requests", async (request) => {
    const qs = new URLSearchParams(request.query as Record<string, string>);
    return proxyGet(`/request?${qs}`);
  });
};
