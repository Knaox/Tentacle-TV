import { describe, expect, it } from "vitest";
import fr from "../i18n/locales/fr/errors";
import en from "../i18n/locales/en/errors";
import {
  DATABASE_MIGRATION_REASONS, DB_MIGRATION_COPY, DB_MIGRATION_REASON_KEYS, databaseMigrationOf, dbMigrationEta,
  dbMigrationRetryClock, isMigrationMaintenance,
} from "./databaseMigrationView";

const has = (locale: Record<string, string>, key: string) => typeof locale[key.replace(/^errors:/, "")] === "string";

describe("écran d'attente de la migration de la base", () => {
  it("chaque motif d'échec a sa phrase, en français ET en anglais", () => {
    for (const reason of DATABASE_MIGRATION_REASONS) {
      const key = DB_MIGRATION_REASON_KEYS[reason];
      expect(has(fr, key), `${reason} (fr)`).toBe(true);
      expect(has(en, key), `${reason} (en)`).toBe(true);
    }
  });

  it("chaque phrase de l'écran existe en français ET en anglais", () => {
    for (const key of Object.values(DB_MIGRATION_COPY)) {
      expect(has(fr, key), `${key} (fr)`).toBe(true);
      expect(has(en, key), `${key} (en)`).toBe(true);
    }
  });

  it("lit /api/health : migration en cours, en nombres", () => {
    expect(databaseMigrationOf({ database: { engine: "sqlite", state: "migrating", progress: { done: 3, total: 49, percent: 10.7, etaSeconds: 42 } } }))
      .toEqual({ kind: "migrating", percent: 10, done: 3, total: 49, etaSeconds: 42 });
  });

  it("lit un échec ; un motif inconnu devient « unknown », jamais une chaîne libre", () => {
    expect(databaseMigrationOf({ database: { state: "failed", reason: "disk_space", retryInSeconds: 30, progress: { percent: 5 } } }))
      .toEqual({ kind: "failed", reason: "disk_space", retryInSeconds: 30, percent: 5 });
    expect(databaseMigrationOf({ database: { state: "failed", reason: "<script>" } })).toMatchObject({ reason: "unknown" });
    // Pas de nouvel essai automatique (MariaDB plus configurée) : rien à en dire.
    expect(databaseMigrationOf({ database: { state: "failed", reason: "source_missing" } })).toMatchObject({ reason: "source_missing", retryInSeconds: null });
  });

  it("rien à montrer : base prête, serveur d'avant 1.25, réponse illisible", () => {
    expect(databaseMigrationOf({ database: { engine: "sqlite", state: "ready" } })).toBeNull();
    expect(databaseMigrationOf({ status: "ok", bootId: "x" })).toBeNull();
    expect(databaseMigrationOf(null)).toBeNull();
    expect(databaseMigrationOf("nope")).toBeNull();
  });

  it("un 503 du mode maintenance se reconnaît ; un 503 ordinaire non", () => {
    expect(isMigrationMaintenance(503, { state: "migrating", progress: null })).toBe(true);
    expect(isMigrationMaintenance(503, { message: "Database unavailable" })).toBe(false);
    expect(isMigrationMaintenance(200, { state: "migrating" })).toBe(false);
  });

  it("temps restant et prochain essai en mots", () => {
    expect(dbMigrationEta(null).key).toBe(DB_MIGRATION_COPY.etaUnknown);
    expect(dbMigrationEta(30).key).toBe(DB_MIGRATION_COPY.etaSoon);
    expect(dbMigrationEta(150)).toEqual({ key: DB_MIGRATION_COPY.etaMinutes, minutes: 3 });
    expect(dbMigrationRetryClock(45)).toBe("45 s");
    expect(dbMigrationRetryClock(150)).toBe("2 min 30 s");
  });
});
