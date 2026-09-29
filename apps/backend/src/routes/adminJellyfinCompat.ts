import type { FastifyPluginAsync } from "fastify";
import { buildCompatReport } from "../services/jellyfinCompat/compatService";

/**
 * La compatibilité de Jellyfin, vue de l'administration (vue d'ensemble et
 * Services) : la version installée, la dernière publiée, et ce que Tentacle
 * sait de chacune. Enregistré depuis `adminRoutes`, donc derrière
 * `requireAdmin`. Contrat : `packages/shared/src/jellyfinCompat/compatReport.ts`.
 */
export const adminJellyfinCompatRoutes: FastifyPluginAsync = async (app) => {
  /** GET /api/admin/jellyfin/compat — ce qu'on sait, relu s'il a vieilli. */
  app.get("/jellyfin/compat", async () => buildCompatReport(false));

  /** POST /api/admin/jellyfin/compat/refresh — relit le manifeste publié et GitHub, sans attendre qu'ils vieillissent. */
  app.post("/jellyfin/compat/refresh", async () => buildCompatReport(true));
};
