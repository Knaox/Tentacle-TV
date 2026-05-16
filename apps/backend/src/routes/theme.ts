import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth";
import {
  clearCustomCss,
  clearTokensOverride,
  getActiveCustomCss,
  getThemeState,
  partialThemeTokensSchema,
  setCustomCssInline,
  setCustomCssUrl,
  setThemeName,
  setTokensOverride,
} from "../services/themeStore";

/**
 * Theme API — global, server-wide theme today; per-user overlays planned.
 *
 * Public:
 *   GET  /api/theme          → metadata + tokens override (used by all clients
 *                              to merge over `DEFAULT_THEME` from @tentacle-tv/theme)
 *   GET  /api/theme/css      → active custom CSS (text/css, ETag-aware)
 *
 * Admin (Jellyfin admin token required):
 *   PUT    /api/theme/tokens     → upsert partial tokens override
 *   DELETE /api/theme/tokens     → clear override
 *   PUT    /api/theme/custom-css → set inline content or remote URL
 *   DELETE /api/theme/custom-css → clear
 *   PUT    /api/theme/name       → rename the active theme
 */

const customCssSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("inline"),
    content: z.string().max(2 * 1024 * 1024),
  }),
  z.object({
    source: z.literal("url"),
    url: z.string().min(1).max(4096),
  }),
]);

const nameSchema = z.object({
  name: z.string().max(80),
});

export const themeRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (_request, reply) => {
    // Theme state must always be fresh — admin updates need to reach clients
    // immediately. The CSS body itself is cached per-hash via the /css ETag.
    reply.header("cache-control", "no-store, max-age=0");
    return getThemeState();
  });

  app.get("/css", async (request, reply) => {
    const css = getActiveCustomCss();
    if (!css) {
      reply.header("content-type", "text/css; charset=utf-8");
      reply.header("cache-control", "public, max-age=30, must-revalidate");
      return reply.send("");
    }
    const etag = `"${css.hash}"`;
    const ifNoneMatch = request.headers["if-none-match"];
    reply.header("etag", etag);
    reply.header("cache-control", "public, max-age=60, must-revalidate");
    reply.header("content-type", "text/css; charset=utf-8");
    if (ifNoneMatch === etag) {
      return reply.status(304).send();
    }
    return reply.send(css.content);
  });

  app.put(
    "/tokens",
    { preHandler: [requireAdmin] },
    async (request) => {
      const body = partialThemeTokensSchema.parse(request.body);
      await setTokensOverride(body);
      return { ok: true, state: getThemeState() };
    },
  );

  app.delete(
    "/tokens",
    { preHandler: [requireAdmin] },
    async () => {
      await clearTokensOverride();
      return { ok: true, state: getThemeState() };
    },
  );

  app.put(
    "/custom-css",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const body = customCssSchema.parse(request.body);
      try {
        if (body.source === "inline") {
          await setCustomCssInline(body.content);
        } else {
          await setCustomCssUrl(body.url);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return reply.status(400).send({ message });
      }
      return { ok: true, state: getThemeState() };
    },
  );

  app.delete(
    "/custom-css",
    { preHandler: [requireAdmin] },
    async () => {
      await clearCustomCss();
      return { ok: true, state: getThemeState() };
    },
  );

  app.put(
    "/name",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const body = nameSchema.parse(request.body);
      try {
        await setThemeName(body.name);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return reply.status(400).send({ message });
      }
      return { ok: true, state: getThemeState() };
    },
  );
};
