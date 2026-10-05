import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { applyDatabaseSchema, SCHEMA_FILES, singleConnectionUrl } from "./coreSchema";
import { splitSqlStatements } from "./splitSql";

/**
 * Contre une VRAIE MariaDB jetable, seulement si on la donne :
 *   TENTACLE_TEST_MARIADB_URL=mysql://root:…@127.0.0.1:3371/wiz_schema pnpm vitest run coreSchema
 * La base doit être VIDE et sacrifiable : le test y pose le schéma et l'y laisse.
 */
const url = process.env.TENTACLE_TEST_MARIADB_URL;

describe("URL à connexion unique", () => {
  it("force connection_limit=1 sans perdre les autres paramètres", () => {
    const out = new URL(singleConnectionUrl("mysql://u:p%40ss@db:3306/tentacle?connect_timeout=5&connection_limit=9"));
    expect(out.searchParams.get("connection_limit")).toBe("1");
    expect(out.searchParams.get("connect_timeout")).toBe("5");
    expect(decodeURIComponent(out.password)).toBe("p@ss");
  });
});

describe.skipIf(!url)("schéma posé par le client Prisma, sur une vraie MariaDB", () => {
  // Construits dans les tests : même sauté, le corps du `describe` est évalué à la collecte.
  let prisma: PrismaClient | undefined;
  const workDir = mkdtempSync(join(tmpdir(), "wiz-schema-"));
  const files = { full: join(workDir, "schema-full.sql"), coreInit: SCHEMA_FILES.coreInit };
  afterAll(async () => {
    await prisma?.$disconnect();
    rmSync(workDir, { recursive: true, force: true });
  });

  it("base vierge à moitié : complète tout le schéma, garde une table de plugin, puis se rejoue sans rien refaire", async () => {
    // Le même SQL que celui que le build de l'image génère.
    execFileSync("pnpm", ["exec", "prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel",
      resolve(__dirname, "../../../prisma/schema.prisma"), "--script", "-o", files.full], { stdio: "pipe" });

    prisma = new PrismaClient({ datasources: { db: { url } } });
    // Une table de plugin (Vigie) déjà là : elle ne doit jamais disparaître.
    await prisma.$executeRawUnsafe("CREATE TABLE IF NOT EXISTS `seer_requests` (`id` int PRIMARY KEY)");
    // Ce que laissait une image d'avant démarrée sur une base neuve : le début
    // de core-init.sql (share_links…), mais pas server_config.
    const coreInit = splitSqlStatements(readFileSync(SCHEMA_FILES.coreInit, "utf-8"));
    await prisma.$executeRawUnsafe(coreInit[0]);

    const first = await applyDatabaseSchema(url!, files);
    expect(first.bootstrapped).toBe(true);
    const second = await applyDatabaseSchema(url!, files);
    expect(second).toEqual({ bootstrapped: false, statements: 143 });

    const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()",
    );
    const names = tables.map((t) => t.name);
    for (const expected of ["seer_requests", "server_config", "paired_devices", "notifications", "share_links"]) {
      expect(names).toContain(expected);
    }

    // Le client lit et écrit ce qui a été posé, colonnes ajoutées par les blocs PREPARE comprises.
    await prisma.serverConfig.upsert({ where: { key: "wiz_probe" }, create: { key: "wiz_probe", value: "1" }, update: {} });
    expect((await prisma.serverConfig.findUnique({ where: { key: "wiz_probe" } }))?.value).toBe("1");
    await expect(prisma.pairedDevice.count()).resolves.toBe(0);
    await expect(prisma.shareLink.count()).resolves.toBe(0);
  }, 120_000);
});
