import type { PrismaClient } from "@prisma/client";
import { applyCoreMigrations } from "../../src/services/database/migrator";
import { connectSqlitePrisma } from "../../src/services/database/prismaClient";
import { tempDatabaseDir } from "./tempDatabase";

/**
 * Une VRAIE base SQLite pour un test : migrations du cœur appliquées, client
 * Prisma réglé comme en production (une connexion, PRAGMA). Fichier jetable.
 *
 *   const db = await openTestPrisma();
 *   vi.mock("../db", () => ({ getPrisma: () => holder.prisma }));
 */
export interface TestPrisma {
  prisma: PrismaClient;
  path: string;
  close: () => Promise<void>;
}

export async function openTestPrisma(): Promise<TestPrisma> {
  const temp = tempDatabaseDir();
  const path = temp.use("tentacle.db");
  applyCoreMigrations(path);
  const prisma = await connectSqlitePrisma(path);
  return {
    prisma,
    path,
    close: async () => {
      await prisma.$disconnect();
      temp.cleanup();
    },
  };
}
