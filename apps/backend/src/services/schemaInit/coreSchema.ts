import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { idempotentDdl } from "./idempotentDdl";
import { splitSqlStatements } from "./splitSql";
import { runStatements, type SqlSession } from "./runStatements";

/**
 * Le schéma de la base, posé au démarrage par le client Prisma — sans la CLI,
 * qui n'est plus dans l'image (elle et son moteur de schéma pesaient, et
 * `npx prisma` ralentissait chaque démarrage).
 *
 * Deux fichiers, deux rôles :
 * - `schema-full.sql`, GÉNÉRÉ au build depuis `schema.prisma`
 *   (`pnpm db:schema-sql`) : tout le schéma, joué UNE fois, sur une base
 *   vierge. C'est ce que faisait `prisma db push` à l'installation — sans
 *   jamais rien supprimer ensuite ;
 * - `core-init.sql` : les évolutions additives du cœur, rejouées à chaque
 *   démarrage (jamais `db push`, qui supprimerait les tables des plugins).
 */
const PRISMA_DIR = resolve(__dirname, "../../../prisma");
export const SCHEMA_FILES = {
  full: resolve(PRISMA_DIR, "schema-full.sql"),
  coreInit: resolve(PRISMA_DIR, "core-init.sql"),
};

/** Une seule connexion : les variables de session du script doivent y survivre. */
export function singleConnectionUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("connection_limit", "1");
  return url.toString();
}

function prismaSession(prisma: PrismaClient): SqlSession {
  return {
    async execute(sql) {
      await prisma.$executeRawUnsafe(sql);
    },
    async readVariable(name) {
      // `name` vient d'une expression `\w+` : rien d'autre ne peut entrer ici.
      const rows = await prisma.$queryRawUnsafe<Array<{ value: unknown }>>(`SELECT @${name} AS value`);
      const value = rows[0]?.value;
      if (value === null || value === undefined) return null;
      return Buffer.isBuffer(value) ? value.toString("utf8") : String(value);
    },
  };
}

/** Une base vierge pour Tentacle : sa table de configuration n'existe pas encore. */
async function isBlankDatabase(prisma: PrismaClient): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint | number }>>(
    "SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_config'",
  );
  return Number(rows[0]?.n ?? 0) === 0;
}

function readStatements(file: string): string[] {
  if (!existsSync(file)) {
    throw new Error(`${file} absent — il se génère par « pnpm db:schema-sql » (fait au build de l'image)`);
  }
  return splitSqlStatements(readFileSync(file, "utf-8"));
}

export interface DatabaseSchemaResult {
  /** La base était vierge : le schéma complet vient d'y être posé. */
  bootstrapped: boolean;
  statements: number;
}

/** Pose le schéma si la base est vierge, puis applique `core-init.sql`. Lève à la première instruction refusée. */
export async function applyDatabaseSchema(databaseUrl: string, files = SCHEMA_FILES): Promise<DatabaseSchemaResult> {
  const prisma = new PrismaClient({ datasources: { db: { url: singleConnectionUrl(databaseUrl) } } });
  try {
    const session = prismaSession(prisma);
    const bootstrapped = await isBlankDatabase(prisma);
    let statements = 0;
    if (bootstrapped) {
      // Rejouable : une base « vierge » peut porter déjà quelques tables (idempotentDdl.ts).
      const full = readStatements(files.full).map(idempotentDdl);
      await runStatements(session, full);
      statements += full.length;
    }
    const coreInit = readStatements(files.coreInit);
    await runStatements(session, coreInit);
    return { bootstrapped, statements: statements + coreInit.length };
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}
