import type { PrismaClient } from "@prisma/client";
import type { RawExecutor } from "./createPluginStorage";

/**
 * L'interface de stockage sur le client Prisma du cœur : SQL brut, paramètres
 * `?`, transaction interactive courte (la connexion est unique : pendant
 * qu'elle tourne, les autres requêtes du processus attendent leur tour).
 */

type RawClient = Pick<PrismaClient, "$queryRawUnsafe" | "$executeRawUnsafe">;

function over(client: RawClient, open: ((fn: (tx: RawClient) => Promise<unknown>) => Promise<unknown>) | null): RawExecutor {
  const executor: RawExecutor = {
    query: (sql, params) => client.$queryRawUnsafe<Record<string, unknown>[]>(sql, ...params),
    execute: (sql, params) => client.$executeRawUnsafe(sql, ...params),
    // Dans une transaction, une transaction imbriquée reste la même.
    transaction: async <T>(fn: (tx: RawExecutor) => Promise<T>) =>
      open ? (open((tx) => fn(over(tx, null))) as Promise<T>) : fn(executor),
  };
  return executor;
}

export function prismaExecutor(prisma: PrismaClient): RawExecutor {
  // Délais du client (`transactionOptions`, DECISION.md § 4) : une transaction ne se prolonge pas.
  return over(prisma, (fn) => prisma.$transaction((tx) => fn(tx)));
}
