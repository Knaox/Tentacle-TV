import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import { getJellyfinUrl, getJellyfinApiKey, setConfigValue, setAppState } from "../services/configStore";
import {
  getPrisma,
  getDatabaseUrl,
  saveDatabaseUrl,
  getActiveDatabaseUrl,
  getDatabaseUrlSource,
  probeDatabase,
} from "../services/db";
import { parseDatabaseUrl } from "../services/databaseInfo";
import { restartJellyfinWs } from "../services/jellyfinWs";
import { invalidateAdminKeyHealth } from "../services/jellyfinKeyHealth";
import { jellyfinAuthHeaders } from "../services/jellyfinAuth";

/**
 * Les connexions du serveur, vues de la page admin « Services » : état de
 * Jellyfin et de la base, leur configuration, et la réinitialisation.
 *
 * Enregistré depuis `adminRoutes`, donc derrière `requireAdmin`. À part
 * d'`admin.ts`, qui frôlait les trois cents lignes.
 *
 * Les échecs portent un CODE (`error`) que la page traduit, et gardent le
 * `message` français d'avant : une application de bureau pas encore à jour
 * l'affiche tel quel.
 */

const jellyfinConfigSchema = z.object({
  url: z.string().url(),
  // Absente ou vide : la clé déjà enregistrée. Elle ne redescend jamais au
  // navigateur — changer l'URL ou retester ne demande plus de la retaper.
  apiKey: z.string().optional(),
});

const dbConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(3306),
  database: z.string().min(1),
  user: z.string().min(1),
  password: z.string().min(1),
});

type ServiceError =
  | "invalid-body"
  | "jellyfin-key-missing"
  | "jellyfin-unreachable"
  | "jellyfin-invalid"
  | "jellyfin-rejected";

type JellyfinProbe =
  | { ok: true; version: string; serverName: string }
  | { ok: false; error: "jellyfin-unreachable" | "jellyfin-invalid" }
  | { ok: false; error: "jellyfin-rejected"; httpStatus: number };

function legacyMessage(error: ServiceError, httpStatus?: number): string {
  switch (error) {
    case "invalid-body": return "Requête invalide";
    case "jellyfin-key-missing": return "Clé API requise";
    case "jellyfin-unreachable": return "Impossible de contacter Jellyfin";
    case "jellyfin-invalid": return "Ce serveur ne répond pas comme Jellyfin";
    case "jellyfin-rejected": return `Jellyfin a répondu ${httpStatus ?? "une erreur"}`;
  }
}

function fail(reply: FastifyReply, error: ServiceError, httpStatus?: number) {
  return reply.status(400).send({
    error,
    message: legacyMessage(error, httpStatus),
    ...(httpStatus !== undefined ? { httpStatus } : {}),
  });
}

/**
 * `/System/Info` avec la clé : distingue un Jellyfin qui répond, une clé qu'il
 * refuse, un hôte muet, et une adresse qui n'est pas un Jellyfin.
 */
async function probeJellyfin(url: string, apiKey: string, timeoutMs: number): Promise<JellyfinProbe> {
  let res: Response;
  try {
    res = await fetch(`${url}/System/Info`, {
      headers: jellyfinAuthHeaders(apiKey),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { ok: false, error: "jellyfin-unreachable" };
  }
  if (!res.ok) return { ok: false, error: "jellyfin-rejected", httpStatus: res.status };
  const info = (await res.json().catch(() => null)) as { Version?: unknown; ServerName?: unknown } | null;
  if (typeof info?.Version !== "string") return { ok: false, error: "jellyfin-invalid" };
  return { ok: true, version: info.Version, serverName: typeof info.ServerName === "string" ? info.ServerName : "" };
}

/** L'URL saisie, sans barre finale, et la clé à essayer : la saisie, sinon celle enregistrée. */
function readJellyfinBody(body: unknown): { url: string; typedKey: string | null; apiKey: string | null } | null {
  const parsed = jellyfinConfigSchema.safeParse(body);
  if (!parsed.success) return null;
  const typedKey = parsed.data.apiKey?.trim() || null;
  return {
    url: parsed.data.url.replace(/\/$/, ""),
    typedKey,
    apiKey: typedKey ?? getJellyfinApiKey() ?? null,
  };
}

async function jellyfinStatus() {
  const url = getJellyfinUrl() ?? "";
  const apiKey = getJellyfinApiKey();
  const base = { url, apiKeyConfigured: !!apiKey, version: "", serverName: "" };
  if (!url || !apiKey) return { ...base, status: "disconnected" };
  const probe = await probeJellyfin(url, apiKey, 3000);
  if (probe.ok) return { ...base, status: "connected", version: probe.version, serverName: probe.serverName };
  return {
    ...base,
    status: "error",
    error: probe.error,
    ...(probe.error === "jellyfin-rejected" ? { httpStatus: probe.httpStatus } : {}),
  };
}

async function databaseStatus() {
  const configured = getDatabaseUrl();
  const active = getActiveDatabaseUrl();
  const source = getDatabaseUrlSource();
  const probe = await probeDatabase();
  // La connexion OUVERTE, pas celle qui attend le redémarrage : c'est elle
  // que la sonde vient de mesurer.
  const described = active ?? configured;
  const fields = described ? parseDatabaseUrl(described) : null;
  return {
    status: probe.ok ? "connected" : configured ? "error" : "disconnected",
    version: probe.ok ? probe.version : "",
    source,
    // Gardé pour les clients d'avant `source` ; il dit désormais la même chose.
    fromEnv: source === "env",
    pendingRestart: !!active && !!configured && configured !== active,
    ...(fields ? { fields } : {}),
  };
}

export const adminServicesRoutes: FastifyPluginAsync = async (app) => {
  /** GET /api/admin/services — Jellyfin et la base, sondés à chaque appel. */
  app.get("/services", async () => {
    const [jellyfin, database] = await Promise.all([jellyfinStatus(), databaseStatus()]);
    return { jellyfin, database };
  });

  /** PUT /api/admin/jellyfin — Enregistre l'URL (et la clé, si saisie) après un essai réussi. */
  app.put("/jellyfin", async (request, reply) => {
    const body = readJellyfinBody(request.body);
    if (!body) return fail(reply, "invalid-body");
    if (!body.apiKey) return fail(reply, "jellyfin-key-missing");

    const probe = await probeJellyfin(body.url, body.apiKey, 5000);
    if (!probe.ok) return fail(reply, probe.error, probe.error === "jellyfin-rejected" ? probe.httpStatus : undefined);

    await setConfigValue("jellyfin_url", body.url);
    if (body.typedKey) await setConfigValue("jellyfin_api_key", body.typedKey);
    restartJellyfinWs();
    // Le verdict précédent portait sur l'ancienne clé : le garder ferait
    // survivre l'alerte à sa propre correction pendant cinq minutes.
    invalidateAdminKeyHealth();
    return { success: true, version: probe.version, serverName: probe.serverName };
  });

  /** POST /api/admin/test-jellyfin — Essaie une URL et une clé, sans rien enregistrer. */
  app.post("/test-jellyfin", async (request, reply) => {
    const body = readJellyfinBody(request.body);
    if (!body) return fail(reply, "invalid-body");
    if (!body.apiKey) return fail(reply, "jellyfin-key-missing");

    const probe = await probeJellyfin(body.url, body.apiKey, 5000);
    if (!probe.ok) return fail(reply, probe.error, probe.error === "jellyfin-rejected" ? probe.httpStatus : undefined);
    return { success: true, version: probe.version, serverName: probe.serverName };
  });

  /** PUT /api/admin/database — Update database connection (requires restart). */
  app.put("/database", async (request, reply) => {
    const parsed = dbConfigSchema.safeParse(request.body);
    if (!parsed.success) return fail(reply, "invalid-body");
    const body = parsed.data;
    const url = `mysql://${encodeURIComponent(body.user)}:${encodeURIComponent(body.password)}@${body.host}:${body.port}/${body.database}`;
    saveDatabaseUrl(url);
    return { success: true, message: "Configuration sauvegardée. Redémarrez le serveur pour appliquer." };
  });

  /** POST /api/admin/reset-server — Wipe all config and reset to setup mode. */
  app.post("/reset-server", async (_request, reply) => {
    try {
      const prisma = getPrisma();
      // Wipe all server config rows
      await prisma.serverConfig.deleteMany({});
      // Reset in-memory state to setup mode
      setAppState(process.env.DATABASE_URL ? "setup_jellyfin" : "setup_db");
      return { success: true, message: "Serveur réinitialisé. Rechargez la page." };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur";
      return reply.status(500).send({ message: msg });
    }
  });
};
