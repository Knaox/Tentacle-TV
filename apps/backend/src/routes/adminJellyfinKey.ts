import type { FastifyPluginAsync } from "fastify";
import { santeCleAdmin } from "../services/jellyfinKeyHealth";

/**
 * Santé de la clé admin Jellyfin — enregistré depuis adminRoutes, donc derrière
 * `requireAdmin`.
 *
 * Réservé aux administrateurs, et pas seulement par principe : eux seuls
 * peuvent y remédier, et l'état de la clé du serveur ne regarde pas les autres
 * comptes. `requireAdmin` valide le jeton de l'UTILISATEUR, jamais la clé
 * admin — la route reste donc accessible précisément quand la clé est morte,
 * ce qui est tout l'intérêt.
 */
export const adminJellyfinKeyRoutes: FastifyPluginAsync = async (app) => {
  /** GET /api/admin/jellyfin-key — verdict mis en cache 5 min. */
  app.get("/jellyfin-key", async (request) => {
    const forcer = (request.query as { refresh?: string } | undefined)?.refresh === "1";
    return santeCleAdmin(forcer);
  });
};
