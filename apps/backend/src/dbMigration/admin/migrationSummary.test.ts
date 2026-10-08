import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Le résumé de la migration pour l'administration : la marche à suivre pour
 * retirer MariaDB vient du serveur, commandes comprises, et ne se fonde que sur
 * une source RÉELLE — jamais sur `TENTACLE_STACK` seul.
 */
const m = vi.hoisted(() => ({
  url: "mysql://tentacle:x@db:3306/tentacle" as string | null,
  origin: "env" as "env" | "file" | null,
}));
vi.mock("../../services/db", () => ({ getPrisma: () => ({ serverConfig: { findUnique: async () => null } }) }));
vi.mock("../../services/database/legacySource", () => ({
  MIGRATION_REPORT_KEY: "sqlite_migration_report",
  legacyMariadbUrl: () => m.url,
  legacySourceOrigin: () => m.origin,
  legacySourceState: () => (m.url ? "migrated" : "none"),
  legacyConfigFile: () => "/app/apps/backend/data/database.json",
}));
vi.mock("../../setup/hostInfo", () => ({ hostInfo: () => ({ containerized: true }) }));
vi.mock("../cache/deferredCacheCopy", () => ({ cacheCopyState: () => ({ phase: "done" }), cacheCopyPercent: () => 100 }));
vi.mock("../postMigration", () => ({ sourceDivergence: () => ({ status: "same" }) }));

const { databaseMigrationSummary } = await import("./migrationSummary");

describe("le résumé de la migration : retirer MariaDB", () => {
  beforeEach(() => {
    m.url = "mysql://tentacle:x@db:3306/tentacle";
    m.origin = "env";
  });
  afterEach(() => vi.unstubAllEnvs());

  it("pile officielle d'avant : sa remplaçante d'aujourd'hui, et rien à supprimer côté fichier", async () => {
    vi.stubEnv("TENTACLE_STACK", "full");
    vi.stubEnv("DB_HOST", "db");
    const { removal, sourceConfigured } = await databaseMigrationSummary();
    expect(sourceConfigured).toBe(true);
    expect(removal).toMatchObject({ kind: "official-stack", newStack: "tentacle-full", dbService: "db", origin: "env", forgetCommand: null });
    expect(removal.dropCommand).toBe("DROP DATABASE `tentacle`;");
  });

  it("source dans le fichier de l'ancien assistant : la commande pour le supprimer, donnée par le serveur", async () => {
    m.url = "mysql://tentacle:x@192.168.1.20:3306/tentacle";
    m.origin = "file";
    vi.stubEnv("TENTACLE_STACK", "only");
    vi.stubEnv("DB_HOST", "");
    const { removal } = await databaseMigrationSummary();
    expect(removal).toMatchObject({ kind: "external", origin: "file", forgetCommand: "rm /app/apps/backend/data/database.json" });
  });

  it("installation neuve sur la pile d'aujourd'hui (« full », aucune base) : aucune source, aucune pile à remplacer", async () => {
    m.url = null;
    m.origin = null;
    vi.stubEnv("TENTACLE_STACK", "full");
    vi.stubEnv("DB_HOST", "");
    const summary = await databaseMigrationSummary();
    expect(summary.sourceConfigured).toBe(false);
    expect(summary.removal).toMatchObject({ kind: "unknown", newStack: null, forgetCommand: null });
  });
});
