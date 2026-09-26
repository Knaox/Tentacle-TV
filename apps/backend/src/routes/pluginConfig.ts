import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { lookup } from "dns/promises";
import { getInstalled, saveInstalled, type InstalledPlugin } from "../services/pluginManager";
import { isPrivateIp } from "../services/networkUtils";
import { isValidRouteId } from "./pluginRouteGuards";

const configSchema = z.record(z.unknown());

const proxySchema = z.object({
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET"),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
});

/** Configuration d'un plugin, proxy serveur et état — routes admin. */
export function registerPluginConfigRoutes(admin: FastifyInstance): void {
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
}
