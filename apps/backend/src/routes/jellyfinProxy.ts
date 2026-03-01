import type { FastifyPluginAsync } from "fastify";
import { Readable } from "stream";
import { getJellyfinUrl, getJellyfinApiKey } from "../services/configStore";
import { verifyDeviceToken } from "../services/jwt";

/** Headers to skip when proxying (hop-by-hop). */
const SKIP_REQUEST_HEADERS = new Set([
  "host", "connection", "keep-alive", "transfer-encoding",
  "te", "trailer", "upgrade", "proxy-authorization", "proxy-authenticate",
  // Fastify parses then re-serializes JSON bodies — Content-Length may change.
  // Let Node.js fetch recalculate it from the actual body.
  "content-length",
]);

const SKIP_RESPONSE_HEADERS = new Set([
  "transfer-encoding", "connection", "keep-alive",
  // Node fetch auto-decompresses — don't tell browser content is still compressed
  "content-encoding", "content-length",
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
    let targetUrl = `${jellyfinUrl}/${wildcardPath}${qs}`;

    // Jellyfin bug workaround: its playlist generator (DynamicHlsPlaylistGenerator)
    // propagates the full query string — including StartTimeTicks — from the
    // main.m3u8 request into every segment URL.  But its segment handler
    // (GetDynamicSegment) explicitly rejects StartTimeTicks > 0 with a 400.
    // Strip it from HLS segment requests so transcoded playback works.
    if (/\/hls1\//.test(wildcardPath) && !wildcardPath.endsWith(".m3u8")) {
      try {
        const u = new URL(targetUrl);
        u.searchParams.delete("StartTimeTicks");
        u.searchParams.delete("startTimeTicks");
        targetUrl = u.toString();
      } catch { /* leave targetUrl unchanged */ }
    }

    // Detect JWT device tokens (from paired TV/devices) and replace with
    // the Jellyfin admin API key — Jellyfin only understands its own tokens.
    const incomingToken = request.headers["x-emby-token"] as string | undefined;
    let apiKeyOverride: string | undefined;
    if (incomingToken) {
      const payload = await verifyDeviceToken(incomingToken);
      if (payload) {
        apiKeyOverride = getJellyfinApiKey();
      }
    }

    // Forward request headers
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(request.headers)) {
      if (!SKIP_REQUEST_HEADERS.has(key.toLowerCase()) && typeof value === "string") {
        const lower = key.toLowerCase();
        if (apiKeyOverride) {
          // Replace device JWT with admin API key so Jellyfin accepts the request
          if (lower === "x-emby-token") {
            headers[key] = apiKeyOverride;
            continue;
          }
          if (lower === "x-emby-authorization") {
            headers[key] = value.replace(/Token="[^"]*"/, `Token="${apiKeyOverride}"`);
            continue;
          }
        }
        headers[key] = value;
      }
    }

    // Progressive video streams (remux) can last hours — use a long timeout.
    // HLS segments and API calls complete quickly, keep short timeout.
    const isProgressiveStream = /Videos\/.*\/stream/.test(wildcardPath);
    const timeout = isProgressiveStream ? 4 * 60 * 60 * 1000 : 120_000;

    // Build fetch options
    const fetchInit: RequestInit = {
      method: request.method,
      headers,
      signal: AbortSignal.timeout(timeout),
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

      // Log Jellyfin error responses for debugging
      if (response.status >= 400) {
        const body = await response.text();
        request.log.warn({ status: response.status, path: wildcardPath, method: request.method, body: body.substring(0, 500) }, "Jellyfin error");
        return reply.send(body);
      }

      // 204 No Content: must not include a body per HTTP spec.
      // Avoid piping an empty stream which can confuse some clients.
      if (response.status === 204 || !response.body) {
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
      request.log.error({ path: wildcardPath, method: request.method, error: msg }, "Proxy error");
      return reply.status(502).send({ message: msg });
    }
  });
};
