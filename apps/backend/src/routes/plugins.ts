import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { randomUUID } from "crypto";
import {
  getSources,
  getCustomSources,
  saveCustomSources,
  getInstalled,
  saveInstalled,
  getSeerConfig,
  saveSeerConfig,
  fetchRegistryCached,
  clearCache,
  enrichPlugins,
  downloadPlugin,
  extractPlugin,
  removePluginFiles,
  type PluginSource,
  type InstalledPlugin,
  type EnrichedEntry,
} from "../services/pluginManager";

// ── Zod schemas ──
const addSourceSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1).optional(),
});

const installSchema = z.object({
  pluginId: z.string().min(1),
  version: z.string().min(1),
  sourceId: z.string().min(1),
});

const configSchema = z.record(z.unknown());

// ── Route registration ──
export const pluginRoutes: FastifyPluginAsync = async (app) => {
  app.get("/active", { preHandler: requireAuth }, async () => {
    return getInstalled().filter((p) => p.enabled).map((p) => ({
      id: p.id, pluginId: p.pluginId, name: p.name, version: p.version,
    }));
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

    admin.get("/", async () => getInstalled());

    admin.post("/install", async (request, reply) => {
      const body = installSchema.parse(request.body);
      const installed = getInstalled();
      if (installed.some((p) => p.pluginId === body.pluginId)) {
        return reply.status(409).send({ message: "Plugin already installed" });
      }
      const source = getSources().find((s) => s.id === body.sourceId);
      if (!source) return reply.status(404).send({ message: "Source not found" });

      const registryPlugins = await fetchRegistryCached(source.id, source.url);
      const reg = registryPlugins.find((p) => p.pluginId === body.pluginId && p.version === body.version);
      let pluginName = body.pluginId;
      if (reg) {
        pluginName = reg.name || body.pluginId;
        if (reg.downloadUrl) {
          try {
            const archive = await downloadPlugin(body.pluginId, reg.downloadUrl, reg.checksum);
            await extractPlugin(archive, body.pluginId);
          } catch (err) {
            return reply.status(500).send({ message: err instanceof Error ? err.message : "Download failed" });
          }
        }
      }

      const plugin: InstalledPlugin = {
        id: randomUUID(), pluginId: body.pluginId, sourceId: body.sourceId,
        name: pluginName, version: body.version, enabled: true, config: {},
        installedAt: new Date().toISOString(),
      };
      installed.push(plugin);
      saveInstalled(installed);
      return plugin;
    });

    admin.delete("/:id", async (request, reply) => {
      const { id } = request.params as { id: string };
      const installed = getInstalled();
      const idx = installed.findIndex((p) => p.id === id);
      if (idx === -1) return reply.status(404).send({ message: "Plugin not found" });
      removePluginFiles(installed[idx].pluginId);
      installed.splice(idx, 1);
      saveInstalled(installed);
      return { success: true };
    });

    admin.put("/:id/toggle", async (request, reply) => {
      const { id } = request.params as { id: string };
      const installed = getInstalled();
      const plugin = installed.find((p) => p.id === id);
      if (!plugin) return reply.status(404).send({ message: "Plugin not found" });
      plugin.enabled = !plugin.enabled;
      saveInstalled(installed);
      return plugin;
    });

    admin.post("/:id/update", async (request, reply) => {
      const { id } = request.params as { id: string };
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
      return plugin;
    });

    admin.get("/:id/config", async (request, reply) => {
      const { id } = request.params as { id: string };
      const plugin = getInstalled().find((p) => p.id === id);
      if (!plugin) return reply.status(404).send({ message: "Plugin not found" });
      return plugin.config;
    });

    admin.put("/:id/config", async (request, reply) => {
      const { id } = request.params as { id: string };
      const installed = getInstalled();
      const plugin = installed.find((p) => p.id === id);
      if (!plugin) return reply.status(404).send({ message: "Plugin not found" });
      plugin.config = configSchema.parse(request.body);
      saveInstalled(installed);
      return plugin.config;
    });

    admin.get("/:id/status", async (request, reply) => {
      const { id } = request.params as { id: string };
      const plugin = getInstalled().find((p) => p.id === id);
      if (!plugin) return reply.status(404).send({ message: "Plugin not found" });
      return { id: plugin.id, pluginId: plugin.pluginId, enabled: plugin.enabled, version: plugin.version, healthy: plugin.enabled };
    });

    // ── Seer plugin config ──
    admin.get("/seer/config", async () => getSeerConfig());
    admin.put("/seer/config", async (request) => {
      const config = configSchema.parse(request.body);
      saveSeerConfig(config);
      return config;
    });
  });
};
