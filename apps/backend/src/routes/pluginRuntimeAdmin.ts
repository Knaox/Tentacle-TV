import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePersonalAdmin } from "../middleware/auth";
import { getInstalled } from "../services/pluginManager";
import { isolatedManifestOf, isolatedPluginChanged, isolatedState } from "../plugins/runtime/runtimeRegistry";
import { KNOWN_TOOLS } from "../plugins/runtime/runtimeManifest";
import { grantedTools, setToolGrant } from "../plugins/runtime/tools/toolGrants";
import { ytDlpVersion } from "../plugins/runtime/tools/toolExec";
import { stopPluginWorkers } from "../plugins/runtime/tools/toolWorkers";
import { isValidRouteId } from "./pluginRouteGuards";

/**
 * Le runtime isolé d'une extension, vu de l'administration : l'état de son
 * processus, et les OUTILS qu'elle demande — chacun fermé tant que
 * l'administrateur ne l'a pas permis (liste blanche, `toolGrants.ts`).
 * Permettre ou retirer un outil : administrateur en session PERSONNELLE
 * seulement (une TV jumelée n'ouvre pas un outil du serveur).
 */

const grantSchema = z.object({ allowed: z.boolean() }).strict();

function findPlugin(id: string) {
  return getInstalled().find((p) => p.id === id || p.pluginId === id);
}

export function registerPluginRuntimeAdminRoutes(admin: FastifyInstance): void {
  admin.get("/:id/runtime", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidRouteId(id)) return reply.status(400).send({ message: "Invalid ID" });
    const plugin = findPlugin(id);
    if (!plugin) return reply.status(404).send({ message: "Plugin not found" });
    const manifest = isolatedManifestOf(plugin.pluginId);
    if (!manifest) return { isolated: false };
    const granted = grantedTools(plugin.pluginId);
    const version = granted.length > 0 ? await ytDlpVersion() : null;
    return {
      isolated: true,
      process: isolatedState(plugin.pluginId) ?? { state: "stopped", version: null, lastError: null, restarts: 0 },
      tools: (manifest.tools ?? []).map((tool) => ({ tool, granted: granted.includes(tool), version: granted.includes(tool) ? version : null })),
    };
  });

  admin.put("/:id/tools/:tool", { preHandler: requirePersonalAdmin }, async (request, reply) => {
    const { id, tool } = request.params as { id: string; tool: string };
    if (!isValidRouteId(id)) return reply.status(400).send({ message: "Invalid ID" });
    const plugin = findPlugin(id);
    if (!plugin) return reply.status(404).send({ message: "Plugin not found" });
    const manifest = isolatedManifestOf(plugin.pluginId);
    const known = KNOWN_TOOLS.find((t) => t === tool);
    // Seul un outil que le manifeste DEMANDE se permet : rien d'autre ne s'ouvre d'ici.
    if (!manifest || !known || !(manifest.tools ?? []).includes(known)) return reply.status(400).send({ message: "Tool not requested" });
    const body = grantSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ message: "Invalid body" });
    const tools = setToolGrant(plugin.pluginId, known, body.data.allowed);
    // Retiré : les ouvriers déjà lancés partent tout de suite, rien n'attend leur prochain appel.
    if (!body.data.allowed) stopPluginWorkers(plugin.pluginId);
    await isolatedPluginChanged(plugin.pluginId);
    return { tools };
  });
}
