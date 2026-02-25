import type { FastifyPluginAsync } from "fastify";
import { Readable } from "stream";
import { getJellyfinUrl } from "../services/configStore";

/** Headers to skip when proxying (hop-by-hop). */
const SKIP_REQUEST_HEADERS = new Set([
  "host", "connection", "keep-alive", "transfer-encoding",
  "te", "trailer", "upgrade", "proxy-authorization", "proxy-authenticate",
]);

const SKIP_RESPONSE_HEADERS = new Set([
  "transfer-encoding", "connection", "keep-alive",
]);

export const jellyfinProxyRoutes: FastifyPluginAsync = async (app) => {
  app.all("/*", async (request, reply) => {
    const jellyfinUrl = getJellyfinUrl();
    if (!jellyfinUrl) {
      return reply.status(503).send({ message: "Jellyfin not configured" });
    }

    // Build target URL: strip the prefix that Fastify already consumed
    const wildcardPath = (request.params as Record<string, string>)["*"] || "";
    const qs = request.url.includes("?") ? request.url.slice(request.url.indexOf("?")) : "";
    const targetUrl = `${jellyfinUrl}/${wildcardPath}${qs}`;

    // Forward request headers
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(request.headers)) {
      if (!SKIP_REQUEST_HEADERS.has(key.toLowerCase()) && typeof value === "string") {
        headers[key] = value;
      }
    }

    // Build fetch options
    const fetchInit: RequestInit = {
      method: request.method,
      headers,
      // AbortSignal for timeout (30s for most, longer for streams)
      signal: AbortSignal.timeout(120_000),
    };

    // Forward body for POST/PUT/PATCH/DELETE
    if (request.method !== "GET" && request.method !== "HEAD") {
      const rawBody = request.body;
      if (rawBody !== undefined && rawBody !== null) {
        if (typeof rawBody === "string" || Buffer.isBuffer(rawBody)) {
          fetchInit.body = rawBody as any;
        } else {
          fetchInit.body = JSON.stringify(rawBody);
        }
      }
    }

    try {
      const response = await fetch(targetUrl, fetchInit);

      // Set status
      reply.status(response.status);

      // Forward response headers
      for (const [key, value] of response.headers) {
        if (!SKIP_RESPONSE_HEADERS.has(key.toLowerCase())) {
          reply.header(key, value);
        }
      }

      // Pipe response body
      if (!response.body) {
        return reply.send();
      }

      // Convert Web ReadableStream to Node.js Readable for Fastify
      const nodeStream = Readable.fromWeb(response.body as any);
      return reply.send(nodeStream);
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        return reply.status(504).send({ message: "Jellyfin timeout" });
      }
      const msg = err instanceof Error ? err.message : "Proxy error";
      return reply.status(502).send({ message: msg });
    }
  });
};
