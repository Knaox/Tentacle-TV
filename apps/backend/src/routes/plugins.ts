import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { randomUUID } from "crypto";
import {
  getSources,
  getCustomSources,
  saveCustomSources,
  getInstalled,
  saveInstalled,
  fetchRegistryCached,
  clearCache,
  enrichPlugins,
  downloadPlugin,
  extractPlugin,
  removePluginFiles,
  isValidPluginId,
  assertPathUnderDataDir,
  DATA_DIR,
  type PluginSource,
  type InstalledPlugin,
  type EnrichedEntry,
} from "../services/pluginManager";
import { isPrivateIp } from "../services/networkUtils";
import { lookup } from "dns/promises";

/** Validate :id param — must be a UUID or a valid pluginId (blocks path traversal). */
function isValidRouteId(id: string): boolean {
  // UUID format (internal DB IDs)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return true;
  // Valid plugin ID format
  return isValidPluginId(id);
}

/**
 * Check if a plugin has a server module. If so, the process needs to restart
 * because Fastify cannot register routes after the server is already listening.
 */
function pluginHasServerModule(pluginId: string): boolean {
  if (!isValidPluginId(pluginId)) return false;
  const pluginDir = resolve(DATA_DIR, pluginId);
  const manifestPath = resolve(pluginDir, "plugin.json");
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      if (manifest.server) return true;
    } catch { /* ignore */ }
  }
  return existsSync(resolve(pluginDir, "server", "index.js"))
    || existsSync(resolve(pluginDir, "server", "index.mjs"));
}

function scheduleRestart() {
  console.log("[Plugins] Server module changed — scheduling graceful restart in 1s");
  setTimeout(() => process.exit(0), 1000);
}

// ── Zod schemas ──
const addSourceSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1).optional(),
});

const installSchema = z.object({
  pluginId: z.string().min(1).regex(/^[a-z0-9][a-z0-9._-]{0,63}$/, "Invalid plugin ID format"),
  version: z.string().min(1),
  sourceId: z.string().min(1),
});

const configSchema = z.record(z.unknown());

const proxySchema = z.object({
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET"),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
});

// ── Route registration ──
export const pluginRoutes: FastifyPluginAsync = async (app) => {
  // Shared dependencies bundle (React, ReactDOM, TQ, i18next) — no auth needed
  // DATA_DIR = data/plugins/, shared-deps is at data/shared-deps/
  const sharedDepsPath = resolve(DATA_DIR, "..", "shared-deps", "shared-deps.js");
  let sharedDepsCache: string | null = null;

  app.get("/shared-deps.js", { config: { compress: false } }, async (_request, reply) => {
    if (!existsSync(sharedDepsPath)) {
      return reply.status(404).send({ message: "Shared deps not built. Run: pnpm build:shared-deps" });
    }
    if (!sharedDepsCache) {
      sharedDepsCache = readFileSync(sharedDepsPath, "utf-8");
    }
    const isDev = process.env.NODE_ENV !== "production";
    reply
      .header("Cache-Control", isDev ? "no-cache" : "public, max-age=86400, immutable")
      .type("application/javascript")
      .send(sharedDepsCache);
  });

  // Tailwind CSS runtime (inlined in plugin iframes to avoid CORS/CSP issues in Tauri)
  const tailwindPath = resolve(DATA_DIR, "..", "shared-deps", "tailwind.js");
  let tailwindCache: string | null = null;

  app.get("/tailwind.js", { config: { compress: false } }, async (_request, reply) => {
    if (!existsSync(tailwindPath)) {
      return reply.status(404).send({ message: "tailwind.js not found in data/shared-deps/" });
    }
    if (!tailwindCache) {
      tailwindCache = readFileSync(tailwindPath, "utf-8");
    }
    reply
      .header("Cache-Control", "public, max-age=604800, immutable")
      .type("application/javascript")
      .send(tailwindCache);
  });

  app.get("/active", { preHandler: requireAuth }, async () => {
    return getInstalled().filter((p) => p.enabled && isValidPluginId(p.pluginId)).map((p) => {
      const pluginDir = resolve(DATA_DIR, p.pluginId);
      let navItems: unknown[] = [];
      const manifestPath = resolve(pluginDir, "plugin.json");
      if (existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
          if (Array.isArray(manifest.navItems)) navItems = manifest.navItems;
        } catch { /* ignore malformed manifest */ }
      }
      const configEnabled = (p.config as Record<string, unknown>)?.enabled === true;
      return {
        id: p.id, pluginId: p.pluginId, name: p.name, version: p.version,
        hasBundle: existsSync(resolve(pluginDir, "dist")),
        // Only expose regular navItems when plugin is configured; admin navItems always visible
        navItems: configEnabled
          ? navItems
          : navItems.filter((n: any) => n.admin),
        configEnabled,
      };
    });
  });

  app.get("/:pluginId/bundle", { preHandler: requireAuth, config: { compress: false } }, async (request, reply) => {
    const { pluginId } = request.params as { pluginId: string };
    if (!isValidPluginId(pluginId)) {
      return reply.status(400).send({ message: "Invalid plugin ID" });
    }
    const bundlePath = resolve(DATA_DIR, pluginId, "dist", `plugin-${pluginId}.iife.js`);
    assertPathUnderDataDir(bundlePath);
    if (!existsSync(bundlePath)) {
      return reply.status(404).send({ message: "Bundle not found" });
    }
    reply.type("application/javascript").send(readFileSync(bundlePath));
  });

  await app.register(async (admin) => {
    admin.addHook("preHandler", requireAdmin);

    // ── Sources ──

    admin.get("/sources", async () => getSources());

    admin.post("/sources", async (request, reply) => {
      const body = addSourceSchema.parse(request.body);
      const sources = getSources();
      if (sources.some((s) => s.url === body.url)) {
        return reply.status(409).send({ message: "Source already exists" });
      }
      const source: PluginSource = {
        id: randomUUID(), name: body.name || new URL(body.url).hostname,
        url: body.url, official: false, enabled: true,
      };
      const custom = getCustomSources();
      custom.push(source);
      saveCustomSources(custom);
      return source;
    });

    admin.delete("/sources/:id", async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isValidRouteId(id) && id !== "official") return reply.status(400).send({ message: "Invalid ID" });
      if (id === "official") return reply.status(403).send({ message: "Cannot remove official source" });
      const custom = getCustomSources();
      const idx = custom.findIndex((s) => s.id === id);
      if (idx === -1) return reply.status(404).send({ message: "Source not found" });
      if (custom[idx].official) return reply.status(403).send({ message: "Cannot remove official source" });
      custom.splice(idx, 1);
      saveCustomSources(custom);
      clearCache(id);
      return { success: true };
    });

    admin.put("/sources/:id/toggle", async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isValidRouteId(id) && id !== "official") return reply.status(400).send({ message: "Invalid ID" });
      const sources = getSources();
      const source = sources.find((s) => s.id === id);
      if (!source) return reply.status(404).send({ message: "Source not found" });
      const custom = getCustomSources();
      if (id === "official") {
        const existing = custom.find((s) => s.id === "official");
        if (existing) { existing.enabled = !source.enabled; }
        else { custom.push({ ...source, enabled: !source.enabled }); }
      } else {
        const cs = custom.find((s) => s.id === id);
        if (cs) cs.enabled = !cs.enabled;
      }
      saveCustomSources(custom);
      return { ...source, enabled: !source.enabled };
    });

    admin.post("/sources/refresh", async () => {
      clearCache();
      const sources = getSources().filter((s) => s.enabled);
      const results = await Promise.allSettled(
        sources.map((s) => fetchRegistryCached(s.id, s.url, true)),
      );
      const total = results.reduce((n, r) => n + (r.status === "fulfilled" ? r.value.length : 0), 0);
      return { refreshed: sources.length, plugins: total };
    });

    admin.post("/sources/:id/validate", async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isValidRouteId(id) && id !== "official") return reply.status(400).send({ message: "Invalid ID" });
      const source = getSources().find((s) => s.id === id);
      if (!source) return reply.status(404).send({ message: "Source not found" });
      try {
        const res = await fetch(source.url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return reply.status(502).send({ message: `Source returned ${res.status}` });
        return { valid: true, status: res.status };
      } catch {
        return reply.status(502).send({ message: "Source unreachable" });
      }
    });

    // ── Marketplace ──

    admin.get("/marketplace", async () => {
      const sources = getSources().filter((s) => s.enabled);
      const installed = getInstalled();
      const all: EnrichedEntry[] = [];
      const seen = new Set<string>();
      for (const source of sources) {
        const plugins = await fetchRegistryCached(source.id, source.url);
        for (const entry of enrichPlugins(plugins, source, installed)) {
          if (!seen.has(entry.pluginId)) { seen.add(entry.pluginId); all.push(entry); }
        }
      }
      return all;
    });

    // ── Installed plugins ──

    admin.get("/", async () => getInstalled().map((p) => {
      const pluginDir = resolve(DATA_DIR, p.pluginId);
      let navItems: unknown[] = [];
      const manifestPath = resolve(pluginDir, "plugin.json");
      if (isValidPluginId(p.pluginId) && existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
          if (Array.isArray(manifest.navItems)) navItems = manifest.navItems;
        } catch { /* ignore */ }
      }
      return {
        ...p,
        hasBundle: isValidPluginId(p.pluginId) && existsSync(resolve(pluginDir, "dist")),
        navItems,
      };
    }));

    admin.post("/install", async (request, reply) => {
      try {
        const body = installSchema.parse(request.body);
        const installed = getInstalled();
        if (installed.some((p) => p.pluginId === body.pluginId)) {
          return reply.status(409).send({ message: "Plugin already installed" });
        }
        const source = getSources().find((s) => s.id === body.sourceId);
        if (!source) return reply.status(404).send({ message: "Source not found" });

        const registryPlugins = await fetchRegistryCached(source.id, source.url);
        const reg = registryPlugins.find((p) => p.pluginId === body.pluginId && p.version === body.version);
        console.log("[plugin-install]", { pluginId: body.pluginId, version: body.version, found: !!reg, downloadUrl: reg?.downloadUrl, checksum: reg?.checksum });
        let pluginName = body.pluginId;
        if (reg) {
          pluginName = reg.name || body.pluginId;
          if (reg.downloadUrl) {
            const archive = await downloadPlugin(body.pluginId, reg.downloadUrl, reg.checksum);
            console.log("[plugin-install] downloaded to:", archive);
            await extractPlugin(archive, body.pluginId);
            console.log("[plugin-install] extracted OK");
          }
        }

        const plugin: InstalledPlugin = {
          id: randomUUID(), pluginId: body.pluginId, sourceId: body.sourceId,
          name: pluginName, version: body.version, enabled: true, config: {},
          installedAt: new Date().toISOString(),
        };
        installed.push(plugin);
        saveInstalled(installed);
        if (pluginHasServerModule(body.pluginId)) scheduleRestart();
        return plugin;
      } catch (err) {
        console.error("[plugin-install] ERROR:", err);
        const msg = err instanceof Error ? err.message : "Install failed";
        return reply.status(500).send({ message: msg });
      }
    });

    admin.delete("/:id", async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isValidRouteId(id)) return reply.status(400).send({ message: "Invalid ID" });
      const installed = getInstalled();
      const idx = installed.findIndex((p) => p.id === id);
      if (idx === -1) return reply.status(404).send({ message: "Plugin not found" });
      const hadServer = pluginHasServerModule(installed[idx].pluginId);
      removePluginFiles(installed[idx].pluginId);
      installed.splice(idx, 1);
      saveInstalled(installed);
      if (hadServer) scheduleRestart();
      return { success: true };
    });

    admin.put("/:id/toggle", async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isValidRouteId(id)) return reply.status(400).send({ message: "Invalid ID" });
      const installed = getInstalled();
      const plugin = installed.find((p) => p.id === id);
      if (!plugin) return reply.status(404).send({ message: "Plugin not found" });
      plugin.enabled = !plugin.enabled;
      saveInstalled(installed);
      return plugin;
    });

    admin.post("/:id/update", async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isValidRouteId(id)) return reply.status(400).send({ message: "Invalid ID" });
      const installed = getInstalled();
      const plugin = installed.find((p) => p.id === id);
      if (!plugin) return reply.status(404).send({ message: "Plugin not found" });
      const source = getSources().find((s) => s.id === plugin.sourceId);
      if (!source) return reply.status(404).send({ message: "Source not found" });
      const entries = await fetchRegistryCached(source.id, source.url);
      const latest = entries.find((e) => e.pluginId === plugin.pluginId);
      if (!latest) return reply.status(404).send({ message: "Plugin not found in source" });
      if (latest.version === plugin.version) return { message: "Already up to date", plugin };
      if (latest.downloadUrl) {
        try {
          const saved = { ...plugin.config };
          const archive = await downloadPlugin(plugin.pluginId, latest.downloadUrl, latest.checksum);
          await extractPlugin(archive, plugin.pluginId);
          plugin.config = saved;
        } catch (err) {
          return reply.status(500).send({ message: err instanceof Error ? err.message : "Download failed" });
        }
      }
      plugin.version = latest.version;
      plugin.name = latest.name || plugin.name;
      saveInstalled(installed);
      if (pluginHasServerModule(plugin.pluginId)) scheduleRestart();
      return plugin;
    });

    // Lookup by UUID or pluginId
    function findPlugin(installed: InstalledPlugin[], id: string) {
      return installed.find((p) => p.id === id || p.pluginId === id);
    }

    admin.get("/:id/config", async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isValidRouteId(id)) return reply.status(400).send({ message: "Invalid ID" });
      const plugin = findPlugin(getInstalled(), id);
      if (!plugin) return reply.status(404).send({ message: "Plugin not found" });
      return plugin.config;
    });

    admin.put("/:id/config", async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isValidRouteId(id)) return reply.status(400).send({ message: "Invalid ID" });
      const installed = getInstalled();
      const plugin = findPlugin(installed, id);
      if (!plugin) return reply.status(404).send({ message: "Plugin not found" });
      plugin.config = configSchema.parse(request.body);
      saveInstalled(installed);
      return plugin.config;
    });

    // Generic server-side proxy for plugins (avoids CORS)
    admin.post("/:id/proxy", async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isValidRouteId(id)) return reply.status(400).send({ message: "Invalid ID" });
      const plugin = findPlugin(getInstalled(), id);
      if (!plugin) return reply.status(404).send({ message: "Plugin not found" });
      const { url, method, headers: hdrs, body: reqBody } = proxySchema.parse(request.body);

      // SSRF protection: block non-HTTP schemes
      let parsed: URL;
      try { parsed = new URL(url); } catch { return reply.status(400).send({ message: "Invalid URL" }); }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return reply.status(400).send({ message: "Only HTTP(S) URLs are allowed" });
      }

      // SSRF protection: resolve hostname and warn on private/internal IPs
      // Admin-only route — allow private IPs (Jellyseerr/Overseerr often run on LAN)
      try {
        const { address } = await lookup(parsed.hostname);
        if (isPrivateIp(address)) {
          request.log.warn(`[Plugins] Admin proxy to private IP ${address} (${parsed.hostname}) for plugin ${id}`);
        }
      } catch {
        return reply.status(400).send({ message: "Cannot resolve hostname" });
      }

      try {
        const res = await fetch(url, {
          method,
          headers: hdrs,
          body: reqBody ? JSON.stringify(reqBody) : undefined,
          signal: AbortSignal.timeout(10_000),
        });
        const text = await res.text();
        let json: unknown;
        try { json = JSON.parse(text); } catch { json = null; }
        return { status: res.status, ok: res.ok, data: json ?? text };
      } catch (err) {
        return reply.status(502).send({ message: err instanceof Error ? err.message : "Proxy request failed" });
      }
    });

    admin.get("/:id/status", async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isValidRouteId(id)) return reply.status(400).send({ message: "Invalid ID" });
      const plugin = findPlugin(getInstalled(), id);
      if (!plugin) return reply.status(404).send({ message: "Plugin not found" });
      return { id: plugin.id, pluginId: plugin.pluginId, enabled: plugin.enabled, version: plugin.version, healthy: plugin.enabled };
    });

  });
};
