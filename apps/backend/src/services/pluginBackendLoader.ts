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

  pluginBackendDiag.dataDir = DATA_DIR;
  pluginBackendDiag.enabledPlugins = installed.map((p) => p.pluginId);
  pluginBackendDiag.loadResults = [];

  console.log(`[PluginBackend] DATA_DIR: ${DATA_DIR} (exists: ${existsSync(DATA_DIR)})`);
  if (existsSync(DATA_DIR)) {
    try {
      const contents = readdirSync(DATA_DIR);
      console.log(`[PluginBackend] DATA_DIR contents: ${contents.join(", ")}`);
    } catch { /* ignore */ }
  }
  console.log(`[PluginBackend] Found ${installed.length} enabled plugin(s): ${installed.map((p) => p.pluginId).join(", ") || "(none)"}`);

  for (const plugin of installed) {
    const pluginDir = resolve(DATA_DIR, plugin.pluginId);
    const dirExists = existsSync(pluginDir);
    console.log(`[PluginBackend] Checking "${plugin.pluginId}" — dir: ${pluginDir} (exists: ${dirExists})`);

    if (dirExists) {
      try {
        const files = readdirSync(pluginDir);
        console.log(`[PluginBackend]   Directory contents: ${files.join(", ")}`);
      } catch { /* ignore */ }
    }

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
      const detail = `No server module. Checked: ${serverPaths.join(", ")}`;
      console.log(`[PluginBackend]   ${detail}`);
      pluginBackendDiag.loadResults.push({ pluginId: plugin.pluginId, status: "no_server", detail });
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
        const detail = `Not a function (type: ${typeof pluginFn})`;
        console.warn(`[PluginBackend] ${plugin.pluginId}: ${detail}`);
        pluginBackendDiag.loadResults.push({ pluginId: plugin.pluginId, status: "bad_export", detail });
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
      pluginBackendDiag.loadResults.push({ pluginId: plugin.pluginId, status: "loaded" });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`[PluginBackend] Failed to load backend for "${plugin.pluginId}":`, err);
      pluginBackendDiag.loadResults.push({ pluginId: plugin.pluginId, status: "error", detail });
    }
  }
}
