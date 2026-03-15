import type { FastifyPluginAsync } from "fastify";
import { Readable } from "stream";
import { getJellyfinUrl, getJellyfinApiKey } from "../services/configStore";
import { verifyDeviceToken, hashToken } from "../services/jwt";
import { getPrisma, hasPrisma } from "../services/db";

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
]);

/** Extra headers to strip for non-media (API/JSON) responses.
 *  Node fetch auto-decompresses gzipped JSON — content-length/encoding change.
 *  Media streams pass through raw bytes, so these headers stay accurate. */
const SKIP_API_RESPONSE_HEADERS = new Set([
  "content-encoding", "content-length",
]);

/** Whitelist of allowed Jellyfin proxy path patterns. */
const ALLOWED_PROXY_PATTERNS: RegExp[] = [
  // Streaming — Videos/{id}/... or Videos/{id}/{mediaSourceId}/...
  /^Videos\/[^/]+\/(stream|stream\.mp4|PlaybackInfo)/,
  /^Videos\/[^/]+\/[^/]+\/(master\.m3u8|main\.m3u8|Subtitles)/,
  /^Videos\/[^/]+\/(master\.m3u8|main\.m3u8|Subtitles)/,
  /^Audio\/[^/]+\//,
  /^(Videos\/[^/]+\/)?hls1\//,
  /^Videos\/ActiveEncodings$/,

  // Items & metadata
  /^Items(\/[^/]+)?(\/Images|\/Similar|\/Ancestors|\/PlaybackInfo)?$/,
  /^Items\/[^/]+\/Images\//,

  // User data
  /^Users\/[^/]+\/Items/,
  /^Users\/[^/]+\/FavoriteItems\/[^/]+$/,
  /^Users\/[^/]+\/PlayedItems\/[^/]+$/,
  /^Users\/[^/]+\/Views$/,
  /^Users\/Me$/,
  /^Users\/AuthenticateByName$/,

  // Shows
  /^Shows\/NextUp$/,
  /^Shows\/[^/]+\/(Seasons|Episodes|NextUp)$/,

  // Playback reporting
  /^Sessions\/Playing(\/Progress|\/Stopped)?$/,
  /^Sessions\/Logout$/,

  // Media analysis
  /^MediaSegments\/[^/]+$/,
  /^Episode\/[^/]+\/(IntroSkipperSegments|Timestamps)$/,

  // System
  /^System\/Info\/Public$/,
  /^Branding\/Configuration$/,

  // Search
  /^Search\/Hints$/,

  // Display preferences
  /^DisplayPreferences\//,

  // Filters
  /^(Genres|Studios|Persons|Artists)(\/|$)/,
];

/** Pre-computed case-insensitive versions of ALLOWED_PROXY_PATTERNS. */
const ALLOWED_PROXY_PATTERNS_CI = ALLOWED_PROXY_PATTERNS.map(
  (p) => new RegExp(p.source, "i")
);

function isAllowedProxyPath(path: string): boolean {
  return ALLOWED_PROXY_PATTERNS_CI.some((pattern) => pattern.test(path));
}

export const jellyfinProxyRoutes: FastifyPluginAsync = async (app) => {
  app.all("/*", async (request, reply) => {
    const jellyfinUrl = getJellyfinUrl();
    if (!jellyfinUrl) {
      return reply.status(503).send({ message: "Jellyfin not configured" });
    }

    // Build target URL: strip the prefix that Fastify already consumed
    const wildcardPath = (request.params as Record<string, string>)["*"] || "";

    // Whitelist check: only allow known Jellyfin API paths
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
    const cookieToken = (request as any).cookies?.tentacle_token;
    const incomingToken = (request.headers["x-emby-token"] as string | undefined) || cookieToken;
    let apiKeyOverride: string | undefined;
    if (incomingToken) {
      const payload = await verifyDeviceToken(incomingToken);
      if (payload) {
        apiKeyOverride = getJellyfinApiKey();

        // For session endpoints, use the user's actual Jellyfin token instead of
        // admin API key so Jellyfin can attribute the session to the correct user.
        // Admin API key authenticates the request but loses user context → progress not saved.
        if (apiKeyOverride && /^Sessions\/(Playing|Logout)/.test(wildcardPath) && hasPrisma()) {
          try {
            const prisma = getPrisma();
            const device = await prisma.pairedDevice.findUnique({
              where: { tokenHash: hashToken(incomingToken) },
              select: { jellyfinAccessToken: true },
            });
            if (device?.jellyfinAccessToken) {
              apiKeyOverride = device.jellyfinAccessToken;
            }
          } catch { /* keep admin API key as fallback */ }
        }
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

      // Media streams: forward content-length/encoding so the browser can
      // support Range requests, progress bars, and correct buffering.
      const isMediaResponse = isProgressiveStream || /\/(hls1|Audio)\//.test(wildcardPath);
      for (const [key, value] of response.headers) {
        const lower = key.toLowerCase();
        if (SKIP_RESPONSE_HEADERS.has(lower)) continue;
        if (!isMediaResponse && SKIP_API_RESPONSE_HEADERS.has(lower)) continue;
        reply.header(key, value);
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
