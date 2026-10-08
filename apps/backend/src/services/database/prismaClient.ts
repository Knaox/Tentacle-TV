import { PrismaClient } from "@prisma/client";
import { prismaSqliteUrl } from "./sqlitePath";

/**
 * Le client Prisma de la base SQLite, réglé comme docs/sqlite/DECISION.md le
 * décide : une connexion (`sqlitePath.ts`), des transactions qui attendent
 * leur tour dans la file au lieu d'échouer au bout de 2 s.
 */
export const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 15_000 } as const;

/**
 * Les PRAGMA de la CONNEXION — `journal_mode` vit dans le fichier, le moteur
 * pose `foreign_keys` et `busy_timeout` lui-même. `synchronous = NORMAL` :
 * ×30 sur les écritures (mesuré) ; en WAL il ne peut pas corrompre la base,
 * une coupure de courant peut seulement perdre les dernières validations.
 * Une connexion recyclée revient à FULL : plus lent, jamais moins sûr — on le
 * repose à chaque (re)connexion.
 */
export async function applyConnectionPragmas(client: PrismaClient): Promise<void> {
  await client.$executeRawUnsafe("PRAGMA synchronous = NORMAL");
}

/** Ouvre le client sur une base DÉJÀ migrée (`applyCoreMigrations`). */
export async function connectSqlitePrisma(path: string): Promise<PrismaClient> {
  const client = new PrismaClient({ datasourceUrl: prismaSqliteUrl(path), transactionOptions: TRANSACTION_OPTIONS });
  try {
    await client.$connect();
    await applyConnectionPragmas(client);
    return client;
  } catch (error) {
    await client.$disconnect().catch(() => undefined);
    throw error;
  }
}
