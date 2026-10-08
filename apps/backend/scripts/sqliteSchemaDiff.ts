import { spawnSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { applyCoreMigrations, MIGRATIONS_TABLE, readCoreMigrations } from "../src/services/database/migrator";
import { openSqlite } from "../src/services/database/nodeSqlite";

/**
 * Ce qui sépare les migrations commitées de `schema.prisma`, dit par
 * `prisma migrate diff` (outil de DÉVELOPPEMENT : la CLI Prisma n'est pas dans
 * l'image). Sert au générateur (`pnpm db:migration <nom>`) et au test
 * anti-dérive (`test/sqlite/migrationsDrift.test.ts`).
 */
export const BACKEND_ROOT = resolve(__dirname, "..");
export const SCHEMA_PATH = join(BACKEND_ROOT, "prisma/schema.prisma");

export interface SchemaDiff {
  /** Le SQL qui mènerait les migrations au schéma ; vide = aucune dérive. */
  sql: string;
  migrationCount: number;
}

function runPrisma(args: string[]): string {
  const cli = require.resolve("prisma/build/index.js", { paths: [BACKEND_ROOT] });
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: BACKEND_ROOT,
    encoding: "utf-8",
    env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1", PRISMA_HIDE_PRISMA_TIPS: "1" },
  });
  if (result.status !== 0) throw new Error(`prisma ${args.join(" ")} : ${result.stderr || result.stdout}`);
  return result.stdout;
}

/** `-- This is an empty migration.` et les lignes vides ne sont pas une dérive. */
function meaningfulSql(output: string): string {
  const body = output
    .split("\n")
    .filter((line) => line.trim() !== "" && line.trim() !== "-- This is an empty migration.")
    .join("\n");
  return body ? `${output.trim()}\n` : "";
}

/** Le SQL qui manque aux migrations de `dir` pour atteindre `schema`. */
export function diffMigrationsToSchema(dir: string, schema: string = SCHEMA_PATH): SchemaDiff {
  const migrations = readCoreMigrations(dir);
  if (migrations.length === 0) {
    const sql = runPrisma(["migrate", "diff", "--from-empty", "--to-schema-datamodel", schema, "--script"]);
    return { sql: meaningfulSql(sql), migrationCount: 0 };
  }
  const work = mkdtempSync(join(tmpdir(), "tentacle-sqlite-diff-"));
  try {
    const file = join(work, "from.db");
    applyCoreMigrations(file, migrations);
    // La table de suivi n'est pas dans le schéma : la garder, ce serait une dérive inventée.
    const db = openSqlite(file);
    db.exec(`DROP TABLE "${MIGRATIONS_TABLE}"`);
    db.close();
    const url = `file:${file.replace(/\\/g, "/")}`;
    const sql = runPrisma(["migrate", "diff", "--from-url", url, "--to-schema-datamodel", schema, "--script"]);
    return { sql: meaningfulSql(sql), migrationCount: migrations.length };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
