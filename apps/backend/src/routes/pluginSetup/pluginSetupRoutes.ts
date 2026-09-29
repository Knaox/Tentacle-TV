import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { DATA_DIR, getInstalled, isValidPluginId, saveInstalled, type InstalledPlugin } from "../../services/pluginManager";
import { isValidRouteId } from "../pluginRouteGuards";
import { readPluginSetupMeta, type PluginSetupMeta, type PluginSetupResult } from "./pluginSetup";
import { applySetupValues, describeSetup, readTestVerdict, resolveSetupValues } from "./setupValues";

/**
 * Le formulaire `setup` d'un plugin, côté serveur — générique : les champs, la
 * route de test et les mots viennent du manifeste du plugin (`pluginSetup.ts`),
 * Tentacle n'en connaît aucun.
 *
 * Le test est joué PAR LE SERVEUR, sur la route que le plugin déclare
 * (`app.inject`, avec l'authentification de l'administrateur qui le demande) :
 * les secrets déjà enregistrés y sont complétés sans jamais redescendre au
 * navigateur, et l'enregistrement n'a lieu qu'après un verdict favorable. Il
 * pose alors `enabled: true` — l'intégration est active sans interrupteur à
 * basculer.
 *
 * Routes admin (enregistrées sous le `requireAdmin` de `plugins.ts`).
 */

interface Found {
  plugin: InstalledPlugin;
  meta: PluginSetupMeta;
}

/** Le plugin installé et son contrat `setup`, lu dans SON manifeste — ou la raison de son absence. */
function findSetup(id: string): Found | "unknown" | "no-setup" {
  const plugin = getInstalled().find((candidate) => candidate.id === id || candidate.pluginId === id);
  if (!plugin || !isValidPluginId(plugin.pluginId)) return "unknown";
  const manifestPath = resolve(DATA_DIR, plugin.pluginId, "plugin.json");
  if (!existsSync(manifestPath)) return "no-setup";
  try {
    const meta = readPluginSetupMeta((JSON.parse(readFileSync(manifestPath, "utf-8")) as { setup?: unknown }).setup);
    return meta ? { plugin, meta } : "no-setup";
  } catch {
    return "no-setup";
  }
}

/** Le contrat `setup` d'un manifeste déjà lu, pour la liste des plugins installés. */
export function setupOfManifest(manifest: unknown): PluginSetupMeta | undefined {
  if (!manifest || typeof manifest !== "object") return undefined;
  return readPluginSetupMeta((manifest as { setup?: unknown }).setup) ?? undefined;
}

function resolveRequest(request: FastifyRequest, reply: FastifyReply): Found | null {
  const { id } = request.params as { id: string };
  if (!isValidRouteId(id)) {
    void reply.status(400).send({ error: "invalid-id" });
    return null;
  }
  const found = findSetup(id);
  if (found === "unknown" || found === "no-setup") {
    void reply.status(404).send({ error: found });
    return null;
  }
  return found;
}

/** La route de test du plugin, jouée au nom de l'administrateur qui la demande. */
async function runPluginTest(request: FastifyRequest, found: Found, values: Record<string, string>) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  for (const name of ["authorization", "cookie"] as const) {
    const value = request.headers[name];
    if (typeof value === "string") headers[name] = value;
  }
  const res = await request.server.inject({
    method: "POST",
    url: `/api/plugins/${found.plugin.pluginId}${found.meta.test}`,
    headers,
    payload: JSON.stringify(values),
  });
  let body: unknown = null;
  try {
    body = res.json();
  } catch {
    /* pas du JSON : readTestVerdict dit « test-failed » */
  }
  return readTestVerdict(res.statusCode, body);
}

async function testAndMaybeSave(request: FastifyRequest, reply: FastifyReply, save: boolean) {
  const found = resolveRequest(request, reply);
  if (!found) return reply;
  const resolved = resolveSetupValues(found.meta, (request.body as { values?: unknown } | null)?.values, found.plugin.config ?? {});
  if (!resolved.ok) return reply.status(400).send({ error: "invalid-field", field: resolved.field, reason: resolved.reason });
  const verdict = await runPluginTest(request, found, resolved.values);
  if (!verdict.ok || !save) return { ...verdict, saved: false } satisfies PluginSetupResult;
  // Relu APRÈS le test : une autre écriture a pu passer pendant.
  const installed = getInstalled();
  const target = installed.find((plugin) => plugin.id === found.plugin.id);
  if (!target) return reply.status(404).send({ error: "unknown" });
  target.config = applySetupValues(target.config ?? {}, resolved.values);
  saveInstalled(installed);
  request.log.info({ pluginId: target.pluginId }, "[plugin-setup] configuration enregistrée et activée");
  return { ...verdict, saved: true } satisfies PluginSetupResult;
}

export function registerPluginSetupRoutes(admin: FastifyInstance): void {
  /** GET /api/plugins/:id/setup — le formulaire et ce qui est déjà posé (jamais un secret). */
  admin.get("/:id/setup", async (request, reply) => {
    const found = resolveRequest(request, reply);
    if (!found) return reply;
    return { setup: found.meta, ...describeSetup(found.meta, found.plugin.config ?? {}) };
  });

  /** POST /api/plugins/:id/setup/test — éprouve les valeurs saisies, sans rien enregistrer. */
  admin.post("/:id/setup/test", async (request, reply) => testAndMaybeSave(request, reply, false));

  /** POST /api/plugins/:id/setup — éprouve, puis enregistre et active si le test réussit. */
  admin.post("/:id/setup", async (request, reply) => testAndMaybeSave(request, reply, true));
}
