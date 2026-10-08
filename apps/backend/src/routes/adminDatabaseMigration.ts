import type { FastifyPluginAsync } from "fastify";
import { requirePersonalAdmin } from "../middleware/auth";
import { legacyMariadbUrl } from "../services/database/legacySource";
import { databaseMigrationSummary } from "../dbMigration/admin/migrationSummary";
import { requestRemigration } from "../dbMigration/postMigration";

/**
 * La migration MariaDB → SQLite vue de l'administration (hérite de
 * `requireAdmin`) : le résumé (carte « Base de données », « À régler »,
 * recommandation « retirer MariaDB ») et la remigration à la demande.
 *
 * La remigration est un geste PERSONNEL (web, bureau, mobile — jamais une TV
 * jumelée) : un marqueur, puis un redémarrage contrôlé du serveur — l'écran le
 * dit AVANT, avec l'avertissement du redémarrage des extensions (sans
 * politique `restart:` dans la pile, il faut le relancer à la main).
 */
export const adminDatabaseMigrationRoutes: FastifyPluginAsync = async (app) => {
  app.get("/database/migration", async () => databaseMigrationSummary());

  app.post("/database/remigrate", { preHandler: requirePersonalAdmin }, async (_request, reply) => {
    if (!legacyMariadbUrl()) return reply.status(409).send({ error: "no_legacy_source" });
    requestRemigration();
    return { restarting: true };
  });
};
