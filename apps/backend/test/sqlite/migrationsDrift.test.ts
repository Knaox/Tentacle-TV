import { describe, expect, it } from "vitest";
import { CORE_MIGRATIONS_DIR, readCoreMigrations } from "../../src/services/database/migrator";
import { diffMigrationsToSchema } from "../../scripts/sqliteSchemaDiff";

/**
 * Anti-dérive (docs/sqlite/DECISION.md § 3) : la base que construisent les
 * migrations commitées EST celle que décrit `schema.prisma`. Une retouche du
 * schéma sans sa migration (`pnpm db:migration <nom>`) échoue ici.
 */
describe("migrations SQLite ≡ schema.prisma", () => {
  it("prisma migrate diff ne trouve rien à ajouter", () => {
    expect(readCoreMigrations(CORE_MIGRATIONS_DIR).length).toBeGreaterThan(0);
    expect(diffMigrationsToSchema(CORE_MIGRATIONS_DIR).sql).toBe("");
  }, 60_000);
});
