import { existsSync } from "fs";
import { join } from "path";
import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * L'ouverture de la base par le serveur : en vol unique (la garde et
 * `/api/setup/status` l'appellent en même temps), réessayée au plus toutes
 * les 10 s, jamais à côté d'une MariaDB qui attend sa migration.
 */
const h = vi.hoisted(() => ({ connects: 0, pending: false }));
vi.mock("../../src/services/dataDir", async () => {
  const { mkdtempSync } = await import("fs");
  const { tmpdir } = await import("os");
  const { join } = await import("path");
  return { DATA_ROOT: mkdtempSync(join(tmpdir(), "tentacle-open-")) };
});
vi.mock("../../src/services/database/prismaClient", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/database/prismaClient")>(
    "../../src/services/database/prismaClient",
  );
  return {
    ...actual,
    connectSqlitePrisma: async (path: string) => {
      h.connects += 1;
      return actual.connectSqlitePrisma(path);
    },
  };
});
vi.mock("../../src/services/database/legacySource", () => ({ mariadbMigrationPending: () => h.pending }));

import { DATA_ROOT } from "../../src/services/dataDir";
import { getPrisma, hasPrisma, initPrisma, OPEN_RETRY_INTERVAL_MS, retryDatabaseOpen } from "../../src/services/db";
import { prismaSqliteUrl } from "../../src/services/database/sqlitePath";

afterAll(async () => {
  if (hasPrisma()) await getPrisma().$disconnect();
});

describe("ouverture de la base par le serveur", () => {
  it("une MariaDB qui attend sa migration : aucune base créée à côté", async () => {
    h.pending = true;
    expect(await retryDatabaseOpen(Date.now())).toBe(false);
    expect(existsSync(join(DATA_ROOT, "tentacle.db"))).toBe(false);
    h.pending = false;
  });

  it("dix ouvertures simultanées : UN seul client Prisma", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => initPrisma()));
    expect(results).toEqual(Array(10).fill(true));
    expect(h.connects).toBe(1);
    expect(existsSync(join(DATA_ROOT, "tentacle.db"))).toBe(true);
    // Le client ouvert est celui de toutes : une écriture, une relecture.
    await getPrisma().serverConfig.create({ data: { key: "k", value: "v" } });
    expect(await getPrisma().serverConfig.count()).toBe(1);
  });

  it("une base déjà ouverte ne se rouvre pas", async () => {
    expect(await retryDatabaseOpen(Date.now() + 10 * OPEN_RETRY_INTERVAL_MS)).toBe(true);
    expect(h.connects).toBe(1);
  });
});

describe("chemin de la base", () => {
  it("refuse un dossier de données dont le chemin couperait l'URL de Prisma", () => {
    expect(() => prismaSqliteUrl("/data?x/tentacle.db")).toThrow(/TENTACLE_DATA_DIR/);
    expect(() => prismaSqliteUrl("/data#1/tentacle.db")).toThrow(/TENTACLE_DATA_DIR/);
    expect(prismaSqliteUrl("C:\\Tentacle\\data\\tentacle.db")).toBe("file:C:/Tentacle/data/tentacle.db?connection_limit=1&socket_timeout=15");
  });
});
