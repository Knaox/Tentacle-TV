import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  getSources,
  getCustomSources,
  saveCustomSources,
  getInstalled,
  fetchRegistryCached,
  clearCache,
  enrichPlugins,
  type PluginSource,
  type EnrichedEntry,
} from "../services/pluginManager";
import { isValidRouteId } from "./pluginRouteGuards";

const addSourceSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1).optional(),
});

/** Sources de plugins et catalogue qu'elles publient (marketplace) — routes admin. */
export function registerPluginSourceRoutes(admin: FastifyInstance): void {
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
}
