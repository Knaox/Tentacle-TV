import type { FastifyPluginAsync } from "fastify";
import { Readable } from "stream";
import { fetch as undiciFetch, type RequestInit as UndiciRequestInit } from "undici";
import { getJellyfinUrl, getJellyfinApiKey } from "../services/configStore";
import { verifyDeviceToken, hashToken } from "../services/jwt";
import { getPrisma, hasPrisma } from "../services/db";
import { getCached, setCached, getCacheTtl } from "../services/jellyfinCache";
import { getJellyfinDispatcher } from "../services/jellyfinHttpAgent";
import { isAllowedProxyPath } from "./jellyfinProxy/patterns";
import {
  SKIP_RESPONSE_HEADERS,
  SKIP_API_RESPONSE_HEADERS,
  buildForwardHeaders,
} from "./jellyfinProxy/headers";
import { emitProxyEvents } from "./jellyfinProxy/events";

/** Resolve the API key to forward to Jellyfin:
 *  - Anonymous / native token → no override, pass-through whatever client sent.
 *  - Verified device JWT → use admin API key so Jellyfin accepts the request.
 *  - Session-attribution endpoints → swap to the user's stored Jellyfin token
 *    so playback progress is recorded against the correct account. */
async function resolveApiKeyOverride(
  incomingToken: string | undefined,
  wildcardPath: string,
): Promise<string | undefined> {
  if (!incomingToken) return undefined;
  const payload = await verifyDeviceToken(incomingToken);
  if (!payload) return undefined;

  let apiKey = getJellyfinApiKey();
  const isSessionRoute = /^(Sessions\/(Playing|Logout)|Videos\/ActiveEncodings)/.test(wildcardPath);
  if (apiKey && isSessionRoute && hasPrisma()) {
    try {
      const prisma = getPrisma();
      const device = await prisma.pairedDevice.findUnique({
        where: { tokenHash: hashToken(incomingToken) },
        select: { jellyfinAccessToken: true },
      });
      if (device?.jellyfinAccessToken) apiKey = device.jellyfinAccessToken;
    } catch { /* keep admin API key as fallback */ }
  }
  return apiKey;
}

export const jellyfinProxyRoutes: FastifyPluginAsync = async (app) => {
  app.all("/*", async (request, reply) => {
    const jellyfinUrl = getJellyfinUrl();
    if (!jellyfinUrl) {
      return reply.status(503).send({ message: "Jellyfin not configured" });
    }

    const wildcardPath = (request.params as Record<string, string>)["*"] || "";

    if (!isAllowedProxyPath(wildcardPath)) {
      console.log("[PROXY BLOCKED]", wildcardPath);
      return reply.status(403).send({ error: "Forbidden proxy path" });
    }

    const qs = request.url.includes("?") ? request.url.slice(request.url.indexOf("?")) : "";
    let targetUrl = `${jellyfinUrl}/${wildcardPath}${qs}`;

    // Strip api_key from proxied URLs — auth is handled via X-Emby-Token header.
    // Prevents token leakage in server logs and downstream systems.
    try {
      const u = new URL(targetUrl);
      if (u.searchParams.has("api_key") || u.searchParams.has("ApiKey")) {
        u.searchParams.delete("api_key");
        u.searchParams.delete("ApiKey");
        targetUrl = u.toString();
      }
    } catch { /* leave targetUrl unchanged */ }

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

    // Web clients send auth via httpOnly cookie — inject as X-Emby-Token header
    const cookieToken = (request as { cookies?: { tentacle_token?: string } }).cookies?.tentacle_token;
    const incomingToken = (request.headers["x-emby-token"] as string | undefined) || cookieToken;
    const apiKeyOverride = await resolveApiKeyOverride(incomingToken, wildcardPath);

    // Cache lookup for heavy read routes (Latest/Resume/NextUp/Views).
    // Only applies to GET — mutations always go direct.
    const queryString = qs;
    const cacheTtl = (request.method === "GET" || request.method === "HEAD")
      ? getCacheTtl(wildcardPath) : null;
    if (cacheTtl !== null) {
      const cached = getCached(wildcardPath, queryString, incomingToken);
      if (cached) {
        reply.status(cached.status);
        reply.header("content-type", cached.contentType);
        reply.header("x-tentacle-cache", "HIT");
        return reply.send(cached.body);
      }
    }

    const headers = buildForwardHeaders(request.headers as Record<string, string | string[] | undefined>, apiKeyOverride);

    // Cookie-based auth: inject token as X-Emby-Token if not already present from headers.
    // Use apiKeyOverride (admin API key) when the cookie was a verified device JWT,
    // otherwise forward the raw cookie (Jellyfin native token).
    if (cookieToken && !headers["x-emby-token"] && !headers["X-Emby-Token"]) {
      headers["X-Emby-Token"] = apiKeyOverride ?? cookieToken;
    }

    // Progressive video streams (remux) can last hours — use a long timeout.
    // HLS segments and API calls complete quickly, keep short timeout.
    const isProgressiveStream = /Videos\/.*\/stream/.test(wildcardPath);
    const timeout = isProgressiveStream ? 4 * 60 * 60 * 1000 : 120_000;

    const fetchInit: UndiciRequestInit = {
      method: request.method,
      headers,
      signal: AbortSignal.timeout(timeout),
      // Reuse the keep-alive pool to avoid a TCP+TLS handshake on every
      // HLS segment / API call (~30-50 ms saved per request).
      dispatcher: getJellyfinDispatcher(),
    };

    // Forward body for POST/PUT/PATCH/DELETE
    if (request.method !== "GET" && request.method !== "HEAD") {
      const rawBody = request.body;
      if (rawBody !== undefined && rawBody !== null) {
        if (typeof rawBody === "string" || Buffer.isBuffer(rawBody)) {
          fetchInit.body = rawBody as string | Buffer;
        } else {
          fetchInit.body = JSON.stringify(rawBody);
        }
      }
    }

    try {
      const response = await undiciFetch(targetUrl, fetchInit);
      reply.status(response.status);

      // Media streams: forward content-length/encoding so the browser can
      // support Range requests, progress bars, and correct buffering.
      const isMediaResponse = isProgressiveStream || /\/(hls1|Audio)\//.test(wildcardPath);
      for (const [key, value] of response.headers) {
        const lower = key.toLowerCase();
        if (SKIP_RESPONSE_HEADERS.has(lower)) continue;
        if (!isMediaResponse && SKIP_API_RESPONSE_HEADERS.has(lower)) continue;
        reply.header(key, value);
      }

      // Log Jellyfin error responses for debugging — without buffering the
      // whole body, which would force the entire (potentially multi-MB) error
      // payload into RAM and add 200-500 ms of latency on every 4xx/5xx.
      if (response.status >= 400) {
        request.log.warn(
          { status: response.status, path: wildcardPath, method: request.method },
          "Jellyfin error",
        );
      }

      // Emit WS events on successful mutations
      if (response.status < 400 && request.method !== "GET" && request.method !== "HEAD") {
        emitProxyEvents(wildcardPath, request);
      }

      // 204 No Content: must not include a body per HTTP spec.
      if (response.status === 204 || !response.body) {
        return reply.send();
      }

      // Cacheable routes (Latest/Resume/NextUp/Views): buffer once in RAM so
      // future hits can reply from cache. Media/error routes: stream as-is.
      if (cacheTtl !== null && !isMediaResponse && response.status < 400) {
        const arrayBuf = await response.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        const contentType = response.headers.get("content-type") ?? "application/json";
        setCached(wildcardPath, queryString, incomingToken, buf, contentType, response.status, cacheTtl);
        reply.header("x-tentacle-cache", "MISS");
        return reply.send(buf);
      }

      const nodeStream = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
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
