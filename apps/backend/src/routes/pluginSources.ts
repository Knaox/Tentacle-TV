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
  registryStatus,
  type PluginSource,
  type EnrichedEntry,
} from "../services/pluginManager";
import { isValidRouteId } from "./pluginRouteGuards";

const addSourceSchema = z.object({
  // HTTP(S) seulement : `z.string().url()` laissait passer `data:` ou `ftp:`.
  url: z.string().url().refine((url) => /^https?:\/\//i.test(url), "Only HTTP(S) registry URLs are allowed"),
  name: z.string().trim().min(1).max(80).optional(),
});

/** Une source, et ce qu'on sait de la lecture de son registre. */
const withRegistry = (source: PluginSource) => ({ ...source, registry: registryStatus(source.id) });

/** Sources de plugins et catalogue qu'elles publient (marketplace) — routes admin. */
export function registerPluginSourceRoutes(admin: FastifyInstance): void {
  // ── Sources ──

  admin.get("/sources", async () => getSources().map(withRegistry));

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
    // Lu tout de suite : l'administrateur voit en l'ajoutant si l'adresse
    // répond et ce qu'elle publie, au lieu de découvrir un catalogue vide.
    await fetchRegistryCached(source.id, source.url, true);
    return withRegistry(source);
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
    // Pas de `clearCache()` : une source injoignable garde sa dernière lecture
    // réussie au lieu de sortir du catalogue.
    const sources = getSources().filter((s) => s.enabled);
    const lists = await Promise.all(sources.map((s) => fetchRegistryCached(s.id, s.url, true)));
    const total = lists.reduce((n, list) => n + list.length, 0);
    return {
      refreshed: sources.length,
      plugins: total,
      failed: sources.filter((s) => registryStatus(s.id)?.error).length,
      sources: sources.map(withRegistry),
    };
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
    // Les registres se lisent ensemble : une source lente (dix secondes avant
    // abandon) ne retarde plus toutes les suivantes.
    const lists = await Promise.all(sources.map(async (source) =>
      enrichPlugins(await fetchRegistryCached(source.id, source.url), source, installed)));
    const byId = new Map<string, EnrichedEntry>();
    for (const entry of lists.flat()) {
      const kept = byId.get(entry.pluginId);
      // Publié par deux sources : la première l'emporte, sauf si le plugin
      // installé vient de l'autre — c'est elle que sa mise à jour lira.
      const installedFrom = installed.find((p) => p.pluginId === entry.pluginId)?.sourceId;
      if (!kept || (entry.sourceId === installedFrom && kept.sourceId !== installedFrom)) {
        byId.set(entry.pluginId, entry);
      }
    }
    return [...byId.values()];
  });
}
