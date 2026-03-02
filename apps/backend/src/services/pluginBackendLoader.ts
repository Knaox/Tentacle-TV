import type { FastifyInstance } from "fastify";
import { resolve } from "path";
import { existsSync, readFileSync, readdirSync } from "fs";
import { getInstalled, DATA_DIR } from "./pluginManager";

/** Diagnostic info collected during loading (exposed via /api/health) */
export const pluginBackendDiag: {
  dataDir: string;
  enabledPlugins: string[];
  loadResults: { pluginId: string; status: string; detail?: string }[];
} = { dataDir: "", enabledPlugins: [], loadResults: [] };

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
  console.log(`[PluginBackend] DATA_DIR: ${DATA_DIR}`);
  console.log(`[PluginBackend] Found ${installed.length} enabled plugin(s): ${installed.map((p) => p.pluginId).join(", ") || "(none)"}`);

  for (const plugin of installed) {
    const pluginDir = resolve(DATA_DIR, plugin.pluginId);
    console.log(`[PluginBackend] Checking "${plugin.pluginId}" — dir: ${pluginDir} (exists: ${existsSync(pluginDir)})`);

    // Check plugin.json for a declared server module
    const manifestPath = resolve(pluginDir, "plugin.json");
    let declaredServer: string | null = null;
    if (existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
        if (manifest.server) {
          declaredServer = resolve(pluginDir, manifest.server);
          console.log(`[PluginBackend]   plugin.json declares server: "${manifest.server}" → ${declaredServer}`);
        }
      } catch (e) {
        console.warn(`[PluginBackend]   Failed to parse plugin.json:`, e);
      }
    } else {
      console.log(`[PluginBackend]   No plugin.json at ${manifestPath}`);
    }

    const serverPaths = [
      ...(declaredServer ? [declaredServer] : []),
      resolve(pluginDir, "server", "index.js"),
      resolve(pluginDir, "server", "index.mjs"),
      resolve(pluginDir, "server.js"),
    ];

    const serverPath = serverPaths.find((p) => existsSync(p));
    if (!serverPath) {
      console.log(`[PluginBackend]   No server module found. Checked: ${serverPaths.map((p) => `${p} (${existsSync(p)})`).join(", ")}`);
      continue;
    }

    console.log(`[PluginBackend]   Server module found: ${serverPath}`);

    try {
      const importUrl = `file://${serverPath.replace(/\\/g, "/")}`;
      console.log(`[PluginBackend]   Importing: ${importUrl}`);
      const mod = await import(importUrl);
      console.log(`[PluginBackend]   Module keys: ${Object.keys(mod).join(", ")}`);
      const pluginFn = mod.default || mod;

      if (typeof pluginFn !== "function") {
        console.warn(`[PluginBackend] ${plugin.pluginId}: server module does not export a function (type: ${typeof pluginFn})`);
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
      const prefix = `/api/plugins/${plugin.pluginId}`;
      console.log(`[PluginBackend]   Registering routes with prefix: ${prefix}`);
      await app.register(
        async (scope) => {
          await pluginFn(scope, ctx);
        },
        { prefix },
      );

      console.log(`[PluginBackend] Loaded backend for "${plugin.pluginId}" ✓`);
    } catch (err) {
      console.error(`[PluginBackend] Failed to load backend for "${plugin.pluginId}":`, err);
    }
  }
}
