import type { FastifyInstance, FastifyReply } from "fastify";
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
import {
  BOOT_ID,
  beginPluginOperation,
  isRestartPending,
  requestServerRestart,
} from "../services/pluginRestart";
import { isNewerVersion } from "../services/semver";
import { isValidRouteId, pluginHasServerModule, restartPolicy } from "./pluginRouteGuards";

const installSchema = z.object({
  pluginId: z.string().min(1).regex(/^[a-z0-9][a-z0-9._-]{0,63}$/, "Invalid plugin ID format"),
  version: z.string().min(1),
  sourceId: z.string().min(1),
});

/**
 * Ce que chaque geste rend en plus de son résultat : le redémarrage qu'il a
 * programmé, et le processus qui répond — l'interface attend qu'un AUTRE
 * processus réponde sur `/api/health` pour annoncer le serveur revenu.
 */
const restartInfo = (restartScheduled: boolean) => ({ restartScheduled, bootId: BOOT_ID });

function refuseWhileRestarting(reply: FastifyReply) {
  return reply.status(503).send({ message: "The server is restarting", ...restartInfo(true) });
}

/**
 * Un geste à la fois par plugin : deux extractions dans le même dossier
 * s'écraseraient, et une désinstallation pendant un téléchargement laisserait
 * des fichiers sans entrée.
 */
const busyPlugins = new Set<string>();

function refuseWhileBusy(reply: FastifyReply) {
  return reply.status(409).send({ message: "Another operation is already running for this plugin" });
}

/** Plugins installés : liste, installation, mise à jour, activation, désinstallation — routes admin. */
export function registerPluginInstalledRoutes(admin: FastifyInstance): void {
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
      ...restartPolicy(p),
    };
  }));

  admin.post("/install", async (request, reply) => {
    if (isRestartPending()) return refuseWhileRestarting(reply);
    let pluginId: string | null = null;
    const end = beginPluginOperation();
    try {
      const body = installSchema.parse(request.body);
      if (getInstalled().some((p) => p.pluginId === body.pluginId)) {
        return reply.status(409).send({ message: "Plugin already installed" });
      }
      if (busyPlugins.has(body.pluginId)) return refuseWhileBusy(reply);
      pluginId = body.pluginId;
      busyPlugins.add(pluginId);
      const source = getSources().find((s) => s.id === body.sourceId);
      if (!source) return reply.status(404).send({ message: "Source not found" });

      const registryPlugins = await fetchRegistryCached(source.id, source.url);
      const reg = registryPlugins.find((p) => p.pluginId === body.pluginId && p.version === body.version);
      // Une version que la source ne publie plus (catalogue relu entre-temps)
      // enregistrait jusqu'ici un plugin SANS fichiers, sous son identifiant.
      if (!reg) return reply.status(404).send({ message: "This plugin version is no longer published by the source" });
      console.log("[plugin-install]", { pluginId: body.pluginId, version: body.version, downloadUrl: reg.downloadUrl, checksum: reg.checksum });
      if (reg.downloadUrl) {
        const archive = await downloadPlugin(body.pluginId, reg.downloadUrl, reg.checksum);
        console.log("[plugin-install] downloaded to:", archive);
        await extractPlugin(archive, body.pluginId);
        console.log("[plugin-install] extracted OK");
      }

      const plugin: InstalledPlugin = {
        id: randomUUID(), pluginId: body.pluginId, sourceId: body.sourceId,
        name: reg.name || body.pluginId, version: body.version, enabled: true, config: {},
        installedAt: new Date().toISOString(),
      };
      // Relu APRÈS le téléchargement : une autre écriture a pu passer pendant.
      const installed = getInstalled();
      installed.push(plugin);
      saveInstalled(installed);
      const restart = pluginHasServerModule(body.pluginId);
      if (restart) requestServerRestart(`Plugin « ${plugin.name} » installé`);
      return { ...plugin, ...restartInfo(restart) };
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ message: "Invalid install request" });
      console.error("[plugin-install] ERROR:", err);
      const msg = err instanceof Error ? err.message : "Install failed";
      return reply.status(500).send({ message: msg });
    } finally {
      if (pluginId) busyPlugins.delete(pluginId);
      end();
    }
  });

  admin.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidRouteId(id)) return reply.status(400).send({ message: "Invalid ID" });
    if (isRestartPending()) return refuseWhileRestarting(reply);
    const installed = getInstalled();
    const target = installed.find((p) => p.id === id);
    if (!target) return reply.status(404).send({ message: "Plugin not found" });
    if (busyPlugins.has(target.pluginId)) return refuseWhileBusy(reply);
    // Décidé AVANT de retirer les fichiers : seul un module chargé dans ce
    // processus a besoin d'un redémarrage pour disparaître.
    const restart = restartPolicy(target).restartsOn.uninstall;
    removePluginFiles(target.pluginId);
    saveInstalled(installed.filter((p) => p.id !== id));
    if (restart) requestServerRestart(`Plugin « ${target.name} » désinstallé`);
    return { success: true, ...restartInfo(restart) };
  });

  admin.put("/:id/toggle", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidRouteId(id)) return reply.status(400).send({ message: "Invalid ID" });
    const installed = getInstalled();
    const plugin = installed.find((p) => p.id === id);
    if (!plugin) return reply.status(404).send({ message: "Plugin not found" });
    plugin.enabled = !plugin.enabled;
    saveInstalled(installed);
    // Pas de redémarrage ici : l'administrateur choisit son moment
    // (`restartRequired`, puis POST /restart) — il interrompt les lectures.
    return { ...plugin, ...restartPolicy(plugin) };
  });

  admin.post("/:id/update", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidRouteId(id)) return reply.status(400).send({ message: "Invalid ID" });
    if (isRestartPending()) return refuseWhileRestarting(reply);
    const current = getInstalled().find((p) => p.id === id);
    if (!current) return reply.status(404).send({ message: "Plugin not found" });
    if (busyPlugins.has(current.pluginId)) return refuseWhileBusy(reply);
    const source = getSources().find((s) => s.id === current.sourceId);
    if (!source) return reply.status(404).send({ message: "Source not found" });
    const entries = await fetchRegistryCached(source.id, source.url);
    const latest = entries.find((e) => e.pluginId === current.pluginId);
    if (!latest) return reply.status(404).send({ message: "Plugin not found in source" });
    if (!isNewerVersion(latest.version, current.version)) {
      return { message: "Already up to date", plugin: current, ...restartInfo(false) };
    }

    busyPlugins.add(current.pluginId);
    const end = beginPluginOperation();
    try {
      if (latest.downloadUrl) {
        const archive = await downloadPlugin(current.pluginId, latest.downloadUrl, latest.checksum);
        await extractPlugin(archive, current.pluginId);
      }
      // Relu après le téléchargement, comme à l'installation.
      const installed = getInstalled();
      const plugin = installed.find((p) => p.id === id);
      if (!plugin) return reply.status(404).send({ message: "Plugin not found" });
      plugin.version = latest.version;
      plugin.name = latest.name || plugin.name;
      saveInstalled(installed);
      const restart = restartPolicy(plugin).restartsOn.update;
      if (restart) requestServerRestart(`Plugin « ${plugin.name} » mis à jour`);
      return { ...plugin, ...restartInfo(restart) };
    } catch (err) {
      return reply.status(500).send({ message: err instanceof Error ? err.message : "Download failed" });
    } finally {
      busyPlugins.delete(current.pluginId);
      end();
    }
  });

  // Appliquer une activation (`restartRequired`) ou relancer un module en
  // échec, au moment que l'administrateur choisit.
  admin.post("/restart", async () => {
    requestServerRestart("Redémarrage demandé depuis l'administration des plugins");
    return restartInfo(true);
  });
}
