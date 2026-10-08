import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { parseCorsOrigins, tentacleCorsDelegator } from "../../services/tentacleCors";
import { isTrustedProxy } from "../../services/trustedProxies";
import { rateLimitKey, rateLimitMax } from "../../services/rateLimitPolicy";
import { LOG_REDACT_PATHS } from "../../services/logRedaction";
import { maintenanceBody } from "../migrationState";

/**
 * Le serveur de MAINTENANCE, pendant la migration de la base : une instance
 * Fastify À PART, qui ne connaît ni Prisma, ni les routes du cœur, ni les
 * extensions — il n'y en a aucune d'enregistrée, et aucune ne peut s'y glisser.
 * À la bascule, il se ferme ; le démarrage normal reprend ensuite (renommage,
 * Prisma, routes, extensions — une seule fois). Pas de bascule à chaud.
 *
 * Ouverts : `/api/health` (avec `database`), `/api/config` (tiré du code, sans
 * base) et les fichiers statiques (le client web y lit l'écran d'attente).
 * Tout le reste de `/api/*` répond 503 `{ state: "migrating", … }` : les routes
 * du cœur, les extensions, `/api/ws`, et TOUT `/api/setup/*` — l'assistant ne
 * s'ouvre jamais pendant une migration (audit S3), pas même au voisin du réseau
 * local. `GET /api/setup/status` répond lui aussi 503, et dit « fermé » : un
 * 200 non `running` enverrait un client livré dans l'assistant ; un 503, il le
 * prend pour un serveur qui redémarre et réessaie.
 */
export interface MaintenanceServerOptions {
  port: number;
  host: string;
  healthBody: (request: FastifyRequest) => Record<string, unknown>;
  configBody: (request: FastifyRequest) => Record<string, unknown>;
  /** Le client web et `/tv` (`registerStaticClients`), absents des tests. */
  registerStatic?: (app: FastifyInstance) => Promise<void>;
  logger?: boolean;
}

export function migratingReply(reply: FastifyReply) {
  // Les clients livrés réessaient d'eux-mêmes ; `Retry-After` le dit aux autres.
  return reply.status(503).header("retry-after", "5").header("cache-control", "no-store").send(maintenanceBody());
}

export async function buildMaintenanceServer(options: MaintenanceServerOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger === false ? false : { redact: { paths: LOG_REDACT_PATHS, censor: "[redacted]" } },
    trustProxy: (address: string) => isTrustedProxy(address),
  });
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "no-referrer" },
    hsts: { maxAge: 31536000, includeSubDomains: true },
  });
  await app.register(cors, { delegator: tentacleCorsDelegator(parseCorsOrigins(process.env.CORS_ORIGINS)) });
  await app.register(rateLimit, {
    max: (request) => rateLimitMax(request),
    keyGenerator: (request) => rateLimitKey(request),
    timeWindow: "1 minute",
  });

  app.get("/api/health", async (request, reply) => {
    reply.header("cache-control", "no-store");
    return options.healthBody(request);
  });
  app.get("/api/config", async (request, reply) => {
    reply.header("cache-control", "no-store");
    return options.configBody(request);
  });
  app.get("/api/setup/status", async (_request, reply) => {
    return reply
      .status(503)
      .header("retry-after", "5")
      .header("cache-control", "no-store")
      .send({ ...maintenanceBody(), setupOpen: false, dbConnected: false });
  });
  // OPTIONS reste au greffon CORS : le contrôle préalable d'un navigateur doit passer.
  app.route({
    method: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
    url: "/api/*",
    handler: async (_request, reply) => migratingReply(reply),
  });
  if (options.registerStatic) await options.registerStatic(app);
  return app;
}

export async function startMaintenanceServer(options: MaintenanceServerOptions): Promise<FastifyInstance> {
  const app = await buildMaintenanceServer(options);
  await app.listen({ port: options.port, host: options.host });
  return app;
}
