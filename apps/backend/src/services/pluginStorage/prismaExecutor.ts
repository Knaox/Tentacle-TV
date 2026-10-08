import type { PrismaClient } from "@prisma/client";
import type { RawExecutor } from "./createPluginStorage";

/**
 * L'interface de stockage sur le client Prisma du cœur : SQL brut, paramètres
 * `?` (les deux moteurs les comprennent), transaction interactive courte.
 */

type RawClient = Pick<PrismaClient, "$queryRawUnsafe" | "$executeRawUnsafe">;

/** Une transaction ne se prolonge pas : au-delà, elle bloquerait les autres écritures. */
const TRANSACTION_TIMEOUT_MS = 10_000;

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
  return over(prisma, (fn) => prisma.$transaction((tx) => fn(tx), { timeout: TRANSACTION_TIMEOUT_MS }));
}
