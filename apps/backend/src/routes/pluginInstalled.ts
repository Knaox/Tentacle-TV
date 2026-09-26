import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { randomUUID } from "crypto";
import {
  getSources,
  getInstalled,
  saveInstalled,
  fetchRegistryCached,
  isValidPluginId,
  DATA_DIR,
  type InstalledPlugin,
} from "../services/pluginManager";
// Télécharger, vérifier, extraire : le seul endroit où du code venu d'ailleurs
// est écrit sur le disque du serveur. Séparé pour être lu d'un seul tenant.
import { downloadPlugin, extractPlugin, removePluginFiles } from "../services/pluginInstall";
import { isValidRouteId, pluginHasServerModule } from "./pluginRouteGuards";

function scheduleRestart() {
  console.log("[Plugins] Server module changed — scheduling graceful restart in 1s");
  setTimeout(() => process.exit(0), 1000);
}

const installSchema = z.object({
  pluginId: z.string().min(1).regex(/^[a-z0-9][a-z0-9._-]{0,63}$/, "Invalid plugin ID format"),
  version: z.string().min(1),
  sourceId: z.string().min(1),
});

/** Plugins installés : liste, installation, mise à jour, activation, désinstallation — routes admin. */
export function registerPluginInstalledRoutes(admin: FastifyInstance): void {
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
}
