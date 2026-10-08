import { writeFileSync } from "fs";
import { join } from "path";
import { CORE_MIGRATIONS_DIR, readCoreMigrations } from "../src/services/database/migrator";
import { diffMigrationsToSchema } from "./sqliteSchemaDiff";

/**
 * `pnpm --filter @tentacle-tv/backend db:migration <nom>` — écrit la migration
 * SQLite suivante d'après `schema.prisma` (docs/sqlite/DECISION.md § 3).
 *
 * Une migration écrite et commitée ne se retouche plus : le serveur refuse de
 * démarrer sur une base où elle a été appliquée sous une autre forme.
 */
function main(): number {
  const name = (process.argv[2] ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (!name) {
    console.error("Usage : pnpm db:migration <nom>   (ex. pnpm db:migration plugin_migrations)");
    return 2;
  }
  const { sql, migrationCount } = diffMigrationsToSchema(CORE_MIGRATIONS_DIR);
  if (!sql) {
    console.log("Les migrations suivent déjà schema.prisma : rien à écrire.");
    return 0;
  }
  const next = String(migrationCount + 1).padStart(4, "0");
  const known = readCoreMigrations().map((migration) => migration.id);
  if (known.some((id) => id.startsWith(`${next}_`))) {
    console.error(`Une migration ${next} existe déjà.`);
    return 1;
  }
  const file = join(CORE_MIGRATIONS_DIR, `${next}_${name}.sql`);
  writeFileSync(file, `-- Générée par \`pnpm db:migration ${name}\` (prisma migrate diff). Ne se retouche plus une fois publiée.\n${sql}`);
  console.log(`Écrite : ${file}`);
  return 0;
}

process.exitCode = main();
