import type { FastifyInstance } from "fastify";
import { resolve } from "path";
import { existsSync, readFileSync } from "fs";
import { getInstalled, DATA_DIR } from "./pluginManager";

/**
 * Scans installed & enabled plugins for a server module (server/index.js).
 * Each module must export a Fastify plugin function:
 *   export default async function (app: FastifyInstance, ctx: PluginBackendContext) { ... }
 *
 * Routes are automatically scoped under /api/plugins/{pluginId}/.
 */

export interface PluginBackendContext {
  pluginId: string;
  /** Prisma client getter (lazy — call when needed) */
  getPrisma: () => import("@prisma/client").PrismaClient;
  /** Auth middleware */
  requireAuth: (req: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => Promise<void>;
  requireAdmin: (req: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => Promise<void>;
}

export async function loadPluginBackends(app: FastifyInstance): Promise<void> {
  const installed = getInstalled().filter((p) => p.enabled);

  for (const plugin of installed) {
    const pluginDir = resolve(DATA_DIR, plugin.pluginId);

    // Check plugin.json for a declared server module
    const manifestPath = resolve(pluginDir, "plugin.json");
    let declaredServer: string | null = null;
    if (existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
        if (manifest.server) declaredServer = resolve(pluginDir, manifest.server);
      } catch { /* ignore parse errors */ }
    }

    const serverPaths = [
      ...(declaredServer ? [declaredServer] : []),
      resolve(pluginDir, "server", "index.js"),
      resolve(pluginDir, "server", "index.mjs"),
      resolve(pluginDir, "server.js"),
    ];

    const serverPath = serverPaths.find((p) => existsSync(p));
    if (!serverPath) continue;

    try {
      const mod = await import(`file://${serverPath.replace(/\\/g, "/")}`);
      const pluginFn = mod.default || mod;

      if (typeof pluginFn !== "function") {
        console.warn(`[PluginBackend] ${plugin.pluginId}: server module does not export a function`);
        continue;
      }

      // Lazy imports to avoid circular dependencies
      const { getPrisma } = await import("./db");
      const { requireAuth, requireAdmin } = await import("../middleware/auth");

      const ctx: PluginBackendContext = {
        pluginId: plugin.pluginId,
        getPrisma,
        requireAuth,
        requireAdmin,
      };

      // Register plugin routes under /api/plugins/{pluginId}/
      await app.register(
        async (scope) => {
          await pluginFn(scope, ctx);
        },
        { prefix: `/api/plugins/${plugin.pluginId}` },
      );

      console.log(`[PluginBackend] Loaded backend for "${plugin.pluginId}"`);
    } catch (err) {
      console.error(`[PluginBackend] Failed to load backend for "${plugin.pluginId}":`, err);
    }
  }
}
