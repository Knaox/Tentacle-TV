import type { FastifyPluginAsync } from "fastify";
import { buildServerUpdateReport } from "../services/serverUpdate/serverUpdateReport";

/**
 * La mise à jour du serveur, vue du tableau de bord : la version en service,
 * la dernière publiée, et de quoi construire la commande à copier. Rien ne
 * s'exécute d'ici — aucun accès à Docker (décision du 2026-10-03).
 * Enregistré depuis `adminRoutes`, donc derrière `requireAdmin`. Contrat :
 * `packages/shared/src/serverUpdate/serverUpdateContract.ts`.
 */
export const adminServerUpdateRoutes: FastifyPluginAsync = async (app) => {
  /** GET /api/admin/server-update — ce qu'on sait, relu sur GitHub s'il a plus de six heures. */
  app.get("/server-update", async () => buildServerUpdateReport(false));

  /** POST /api/admin/server-update/refresh — « Revérifier » : relu sans attendre (une fois par minute au plus). */
  app.post("/server-update/refresh", async () => buildServerUpdateReport(true));
};
