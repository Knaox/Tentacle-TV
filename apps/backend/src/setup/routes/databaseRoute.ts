import { PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { detectAppState } from "../../services/configStore";
import { getDatabaseUrlSource, reinitPrisma, saveDatabaseUrl } from "../../services/db";
import { ensureInstallId } from "../../services/jellyfinIdentity";
import { applyDatabaseSchema } from "../../services/schemaInit/coreSchema";
import { SetupError } from "../setupErrors";
import { requireSetupSession } from "../setupGuard";
import { prepareJellyfin } from "../setupRuntime";
import { databaseSchema } from "../setupSchemas";
import type { SetupDatabaseRequest, SetupErrorCode } from "../setupWizardContract";

/**
 * POST /api/setup/database — la base d'une installation qui n'en reçoit pas
 * par l'environnement (pile « seule », natif). Le mot de passe n'est ni
 * renvoyé ni journalisé ; il finit dans `data/database.json`, comme avant.
 * Une base donnée par la pile (`DB_*`, `DATABASE_URL`) ne se change pas ici.
 */
export function databaseUrl(body: SetupDatabaseRequest): string {
  const enc = encodeURIComponent;
  const host = body.host.includes(":") && !body.host.startsWith("[") ? `[${body.host}]` : body.host;
  return `mysql://${enc(body.user)}:${enc(body.password)}@${host}:${body.port}/${enc(body.database)}`;
}

/** Le refus de MariaDB, dit en un code (codes d'erreur de Prisma P1000…P1017). */
export function databaseErrorCode(err: unknown): SetupErrorCode {
  const code = (err as { errorCode?: unknown }).errorCode;
  if (code === "P1000") return "db_auth_failed";
  if (code === "P1003") return "db_unknown_database";
  return "db_unreachable";
}

async function tryConnection(url: string): Promise<SetupErrorCode | null> {
  // Délai de connexion court : une adresse fausse ne doit pas suspendre l'assistant.
  const client = new PrismaClient({ datasources: { db: { url: `${url}?connect_timeout=5` } } });
  try {
    await client.$connect();
    await client.$queryRawUnsafe("SELECT 1");
    return null;
  } catch (err) {
    return databaseErrorCode(err);
  } finally {
    await client.$disconnect().catch(() => undefined);
  }
}

export const setupDatabaseRoute: FastifyPluginAsync = async (app) => {
  app.post(
    "/database",
    { preHandler: requireSetupSession, config: { rateLimit: { max: 10, timeWindow: 60_000 } } },
    async (request): Promise<{ success: true }> => {
      if (getDatabaseUrlSource() === "env") throw new SetupError("db_managed_by_stack");
      const url = databaseUrl(databaseSchema.parse(request.body));
      const refused = await tryConnection(url);
      if (refused) throw new SetupError(refused);
      if (!(await reinitPrisma(url))) throw new SetupError("db_unreachable");
      try {
        await applyDatabaseSchema(url);
      } catch {
        throw new SetupError("db_schema_failed");
      }
      saveDatabaseUrl(url);
      await detectAppState();
      // L'identité du serveur auprès de Jellyfin vit dans la base : elle existe maintenant.
      await ensureInstallId().catch(() => undefined);
      void prepareJellyfin();
      return { success: true };
    },
  );
};
