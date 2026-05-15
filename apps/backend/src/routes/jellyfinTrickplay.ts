import type { FastifyPluginAsync } from "fastify";
import { Readable } from "stream";
import { z } from "zod";
import { getJellyfinUrl, getJellyfinApiKey } from "../services/configStore";
import { verifyDeviceToken } from "../services/jwt";

const ParamsSchema = z.object({
  itemId: z.string().min(1).max(64).regex(/^[A-Za-z0-9-]+$/),
  width: z.coerce.number().int().positive().max(4096),
  index: z.coerce.number().int().nonnegative().max(10_000),
});

const QuerySchema = z.object({
  mediaSourceId: z.string().min(1).max(64).regex(/^[A-Za-z0-9-]+$/).optional(),
  // Token fallback for img/background-image requests that cannot send headers
  // nor cross-origin cookies (matches Jellyfin's native ?api_key= convention).
  api_key: z.string().min(1).optional(),
});

const TRICKPLAY_CACHE_CONTROL = "public, max-age=31536000, immutable";
const FETCH_TIMEOUT_MS = 30_000;

/**
 * Proxy a single Trickplay tile JPEG from Jellyfin with long-lived cache headers.
 * Path: GET /api/jellyfin/items/:itemId/trickplay/:width/:index.jpg
 */
export const jellyfinTrickplayRoutes: FastifyPluginAsync = async (app) => {
  app.get("/items/:itemId/trickplay/:width/:index.jpg", async (request, reply) => {
    const jellyfinUrl = getJellyfinUrl();
    if (!jellyfinUrl) {
      return reply.status(503).send({ message: "Jellyfin not configured" });
    }

    const params = ParamsSchema.parse(request.params);
    const query = QuerySchema.parse(request.query);

    // Auth: accept cookie, X-Emby-Token header, or ?api_key= query.
    // If the token is a Tentacle JWT, swap to admin key. Otherwise pass it
    // through to Jellyfin as-is — it may be a native Jellyfin access token.
    const cookieToken = (request as { cookies?: Record<string, string> }).cookies?.tentacle_token;
    const incomingToken = (request.headers["x-emby-token"] as string | undefined)
      || cookieToken
      || query.api_key;
    if (!incomingToken) {
      return reply.status(401).send({ message: "Unauthorized" });
    }
    const payload = await verifyDeviceToken(incomingToken);
    const adminKey = getJellyfinApiKey();
    const jellyfinToken = payload && adminKey ? adminKey : incomingToken;

    const url = new URL(
      `${jellyfinUrl}/Videos/${params.itemId}/Trickplay/${params.width}/${params.index}.jpg`,
    );
    if (query.mediaSourceId) {
      url.searchParams.set("mediaSourceId", query.mediaSourceId);
    }

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { "X-Emby-Token": jellyfinToken },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (response.status === 404) {
        return reply.status(404).send({ message: "Trickplay tile not found" });
      }
      if (response.status >= 400) {
        const body = await response.text();
        request.log.warn(
          { status: response.status, url: url.pathname, body: body.substring(0, 200) },
          "Jellyfin trickplay error",
        );
        return reply.status(response.status).send(body);
      }
      if (!response.body) {
        return reply.status(502).send({ message: "Empty trickplay response" });
      }

      reply.status(200);
      const contentType = response.headers.get("content-type") ?? "image/jpeg";
      reply.header("content-type", contentType);
      reply.header("cache-control", TRICKPLAY_CACHE_CONTROL);

      return reply.send(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]));
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        return reply.status(504).send({ message: "Jellyfin timeout" });
      }
      const msg = err instanceof Error ? err.message : "Proxy error";
      request.log.error({ url: url.pathname, error: msg }, "Trickplay proxy error");
      return reply.status(502).send({ message: msg });
    }
  });
};
