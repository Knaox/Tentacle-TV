import { HostCallFailure, type HostCallContext, type HostHandlers } from "../hostDispatcher";
import { runtimeServices, type JellyfinMusicHost } from "../hostServices";
import type { ToolName } from "../pluginServerRuntime";
import { isToolGranted } from "../tools/toolGrants";
import { execTool, ytDlpVersion } from "../tools/toolExec";
import { spawnWorker, stopWorker } from "../tools/toolWorkers";
import { emitPluginMusicEvent } from "./musicEvents";
import { userRights } from "./userRights";

/**
 * Les gestionnaires de l'API d'hôte : chaque méthode de `HOST_METHODS`, déjà
 * validée par `hostDispatcher.ts` (méthode, famille déclarée, paramètres). Les
 * outils exigent EN PLUS que le manifeste les demande ET que l'administrateur
 * les ait permis (`toolGrants.ts`). `jellyfin.*` est la musique Jellyfin du
 * cœur (`hostServices.ts`) : ses refus (`code` du contrat) passent tels quels.
 */

function jellyfin(): JellyfinMusicHost {
  const host = runtimeServices().jellyfin;
  if (!host) throw new HostCallFailure("unavailable", "musique Jellyfin indisponible sur ce serveur");
  return host;
}

function requireTool(ctx: HostCallContext, tool: ToolName): void {
  if (!(ctx.manifest.tools ?? []).includes(tool)) throw new HostCallFailure("forbidden", "outil non demandé par le manifeste");
  if (!isToolGranted(ctx.pluginId, tool)) throw new HostCallFailure("forbidden", "outil non permis par l'administrateur");
}

export const HOST_HANDLERS: HostHandlers = {
  "jellyfin.musicLibrary": () => jellyfin().musicLibrary({}),
  "jellyfin.findByMbid": (_ctx, params) => jellyfin().findByMbid(params),
  "jellyfin.setFavorite": (_ctx, params) => jellyfin().setFavorite(params),
  "jellyfin.playlistInsert": (_ctx, params) => jellyfin().playlistInsert(params),
  "jellyfin.playlistEntries": (_ctx, params) => jellyfin().playlistEntries(params),
  "jellyfin.usageOf": (_ctx, params) => jellyfin().usageOf(params),
  "jellyfin.notifyPath": (_ctx, params) => jellyfin().notifyPath(params),
  "users.rights": (ctx, { userId }) => userRights(ctx.pluginId, userId),
  "events.emit": async (ctx, { userIds, event }) => emitPluginMusicEvent(ctx.pluginId, userIds, event),
  "tools.info": async (ctx, { tool }) => {
    const allowed = (ctx.manifest.tools ?? []).includes(tool) && isToolGranted(ctx.pluginId, tool);
    return { version: allowed ? await ytDlpVersion() : null, allowed };
  },
  "tools.exec": async (ctx, { tool, args, timeoutMs }) => {
    requireTool(ctx, tool);
    return execTool(tool, args, timeoutMs, ctx.dataDir);
  },
  "tools.spawnWorker": async (ctx, { tool, name }) => {
    requireTool(ctx, tool);
    return spawnWorker(ctx, tool, name);
  },
  "tools.stopWorker": async (ctx, { workerId }) => {
    stopWorker(ctx.pluginId, workerId);
    return { ok: true };
  },
};
