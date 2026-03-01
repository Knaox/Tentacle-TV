import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { randomUUID } from "crypto";

// ── JSON file storage ──
const DATA_DIR = resolve(__dirname, "../../data/plugins");

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  const path = resolve(DATA_DIR, file);
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, "utf-8")); } catch { return fallback; }
}

function writeJson(file: string, data: unknown): void {
  ensureDir();
  writeFileSync(resolve(DATA_DIR, file), JSON.stringify(data, null, 2), "utf-8");
}

// ── Types ──
interface Source {
  id: string;
  name: string;
  url: string;
  official: boolean;
  enabled: boolean;
}

interface InstalledPlugin {
  id: string;
  pluginId: string;
  sourceId: string;
  name: string;
  version: string;
  enabled: boolean;
  config: Record<string, unknown>;
  installedAt: string;
}

interface MarketplaceEntry {
  pluginId: string;
  name: string;
  description: string;
  version: string;
  author: string;
  sourceId: string;
  sourceName: string;
}

// ── Helpers ──
const SOURCES_FILE = "sources.json";
const INSTALLED_FILE = "installed.json";
const SEER_CONFIG_FILE = "seer-config.json";

function getSources(): Source[] { return readJson<Source[]>(SOURCES_FILE, []); }
function saveSources(s: Source[]) { writeJson(SOURCES_FILE, s); }
function getInstalled(): InstalledPlugin[] { return readJson<InstalledPlugin[]>(INSTALLED_FILE, []); }
function saveInstalled(p: InstalledPlugin[]) { writeJson(INSTALLED_FILE, p); }

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

// ── Registry fetch helper ──
async function fetchRegistry(source: Source): Promise<MarketplaceEntry[]> {
  try {
    const res = await fetch(source.url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const data = await res.json() as { plugins?: MarketplaceEntry[] };
    const plugins = Array.isArray(data) ? data : data.plugins ?? [];
    return (plugins as MarketplaceEntry[]).map((p) => ({
      ...p,
      sourceId: source.id,
      sourceName: source.name,
    }));
  } catch {
    return [];
  }
}

// ── Route registration ──
export const pluginRoutes: FastifyPluginAsync = async (app) => {
  // ═══════════════════════════════════════════
  //  PUBLIC (authenticated, not admin)
  // ═══════════════════════════════════════════
  app.get("/active", { preHandler: requireAuth }, async () => {
    return getInstalled().filter((p) => p.enabled).map((p) => ({
      id: p.id,
      pluginId: p.pluginId,
      name: p.name,
      version: p.version,
    }));
  });

  // ═══════════════════════════════════════════
  //  ADMIN-ONLY ROUTES
  // ═══════════════════════════════════════════
  await app.register(async (admin) => {
    admin.addHook("preHandler", requireAdmin);

    admin.get("/sources", async () => getSources());

    admin.post("/sources", async (request, reply) => {
      const body = addSourceSchema.parse(request.body);
      const sources = getSources();
      if (sources.some((s) => s.url === body.url)) {
        return reply.status(409).send({ message: "Source already exists" });
      }
      const source: Source = {
        id: randomUUID(),
        name: body.name || new URL(body.url).hostname,
        url: body.url,
        official: false,
        enabled: true,
      };
      sources.push(source);
      saveSources(sources);
      return source;
    });

    admin.delete("/sources/:id", async (request, reply) => {
      const { id } = request.params as { id: string };
      const sources = getSources();
      const idx = sources.findIndex((s) => s.id === id);
      if (idx === -1) return reply.status(404).send({ message: "Source not found" });
      if (sources[idx].official) return reply.status(403).send({ message: "Cannot remove official source" });
      sources.splice(idx, 1);
      saveSources(sources);
      return { success: true };
    });

    admin.put("/sources/:id/toggle", async (request, reply) => {
      const { id } = request.params as { id: string };
      const sources = getSources();
      const source = sources.find((s) => s.id === id);
      if (!source) return reply.status(404).send({ message: "Source not found" });
      source.enabled = !source.enabled;
      saveSources(sources);
      return source;
    });

    admin.post("/sources/refresh", async () => {
      const sources = getSources().filter((s) => s.enabled);
      const results = await Promise.allSettled(sources.map(fetchRegistry));
      const total = results.reduce((n, r) => n + (r.status === "fulfilled" ? r.value.length : 0), 0);
      return { refreshed: sources.length, plugins: total };
    });

    admin.post("/sources/:id/validate", async (request, reply) => {
      const { id } = request.params as { id: string };
      const sources = getSources();
      const source = sources.find((s) => s.id === id);
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
      const results = await Promise.allSettled(sources.map(fetchRegistry));
      const all: MarketplaceEntry[] = [];
      const seen = new Set<string>();
      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        for (const entry of r.value) {
          const key = `${entry.pluginId}@${entry.version}`;
          if (!seen.has(key)) { seen.add(key); all.push(entry); }
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
      const sources = getSources();
      const source = sources.find((s) => s.id === body.sourceId);
      if (!source) return reply.status(404).send({ message: "Source not found" });

      const plugin: InstalledPlugin = {
        id: randomUUID(),
        pluginId: body.pluginId,
        sourceId: body.sourceId,
        name: body.pluginId,
        version: body.version,
        enabled: true,
        config: {},
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
      // Fetch latest version from source
      const source = getSources().find((s) => s.id === plugin.sourceId);
      if (!source) return reply.status(404).send({ message: "Source not found" });
      const entries = await fetchRegistry(source);
      const latest = entries.find((e) => e.pluginId === plugin.pluginId);
      if (!latest) return reply.status(404).send({ message: "Plugin not found in source" });
      if (latest.version === plugin.version) return { message: "Already up to date", plugin };
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

    admin.get("/seer/config", async () => {
      return readJson<Record<string, unknown>>(SEER_CONFIG_FILE, {});
    });

    admin.put("/seer/config", async (request) => {
      const config = configSchema.parse(request.body);
      writeJson(SEER_CONFIG_FILE, config);
      return config;
    });
  });
};
