import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { DatabaseMigrationSummary } from "./databaseMigrationApi";

/**
 * Le panneau de migration de la carte « Base de données » : d'où vient la base,
 * la copie du cache en cours (une information, jamais une erreur), les tables
 * recopiées par précaution, et « Migrer à nouveau » seulement quand l'ancienne
 * base a changé ou n'a jamais été migrée.
 */
const h = vi.hoisted(() => ({ data: undefined as unknown }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, o?: Record<string, unknown>) => (o ? `${key}${JSON.stringify(o)}` : key), i18n: { resolvedLanguage: "fr", language: "fr" } }),
}));
vi.mock("./databaseMigrationApi", () => ({
  useDatabaseMigration: () => ({ data: h.data }),
  useRemigrate: () => ({ isSuccess: false, isPending: false, isError: false, mutate: () => undefined }),
}));

const { MigrationPanel } = await import("./MigrationPanel");
const html = () => renderToStaticMarkup(<MigrationPanel />);

const MIGRATED: DatabaseMigrationSummary = {
  legacy: "migrated",
  sourceConfigured: true,
  report: {
    finishedAt: Date.UTC(2026, 9, 8, 12, 0), durationMs: 2600, tables: 49, rows: 97347, sourceEmpty: false, sourceVersion: "10.11.19-MariaDB",
    source: { host: "db", port: 3306, database: "tentacle" }, unrecognized: ["wp_posts"], retired: [], refused: [], deferred: ["tmdb_meta_cache"],
  },
  cache: { phase: "running", percent: 42 },
  sourceCheck: { status: "same" },
  removal: { kind: "compose-service", stack: null, dbService: "db", database: "tentacle", containerized: true, dropCommand: null },
};

describe("panneau de migration", () => {
  beforeEach(() => {
    h.data = MIGRATED;
  });

  it("rien face à un serveur d'avant 1.25 (pas de capacité) ou en attente", () => {
    h.data = null;
    expect(html()).toBe("");
    h.data = undefined;
    expect(html()).toBe("");
  });

  it("la migration faite, la copie du cache en cours, les tables non reconnues", () => {
    const out = html();
    expect(out).toContain("doneOn");
    expect(out).toContain('cacheRunning{&quot;percent&quot;:42}');
    expect(out).toContain("unrecognized");
    expect(out).toContain("wp_posts");
    expect(out).not.toContain("remigrateTitle");
  });

  it("source vide : « installation neuve »", () => {
    h.data = { ...MIGRATED, report: { ...MIGRATED.report!, sourceEmpty: true }, cache: { phase: "none", percent: 0 } };
    expect(html()).toContain("sourceEmpty");
  });

  it("l'ancienne base a changé, ou jamais migrée : « Migrer à nouveau » est proposé", () => {
    h.data = { ...MIGRATED, sourceCheck: { status: "changed", why: "data" } };
    expect(html()).toContain("remigrateTitle");
    h.data = { ...MIGRATED, legacy: "never_migrated", report: null, sourceCheck: null };
    expect(html()).toContain("remigrateTitle");
  });
});
