import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const legacy = vi.hoisted(() => ({ url: null as string | null, state: "none" as string }));
vi.mock("../services/database/legacySource", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/database/legacySource")>()),
  legacyMariadbUrl: () => legacy.url,
  inspectLegacySource: () => legacy.state,
}));
const boot = vi.hoisted(() => ({ migrateOnce: vi.fn() }));
vi.mock("../dbMigration/bootMigration", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../dbMigration/bootMigration")>()),
  migrateOnce: boot.migrateOnce,
}));

import { reportLines, runDbMigrateCommand, serverAlive } from "./dbMigrateCommand";
import { migrationPaths } from "../dbMigration/bootMigration";
import { MigrationFailure } from "../dbMigration/migrationErrors";
import { emptySourceReport } from "../dbMigration/migrationReport";

let dir: string;
let secrets: string;
let out: string[];
// Jamais le vrai dossier de données (apps/backend/data) ni le vrai /run/tentacle-secrets.
const run = () => runDbMigrateCommand(migrationPaths(dir), secrets);
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tentacle-cli-migrate-"));
  secrets = mkdtempSync(join(tmpdir(), "tentacle-cli-secrets-"));
  out = [];
  vi.spyOn(console, "log").mockImplementation((line: string) => void out.push(String(line)));
  boot.migrateOnce.mockReset();
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(secrets, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("tentacle db migrate", () => {
  it("sans ancienne base : rien à migrer, code 0", async () => {
    legacy.url = null;
    expect(await run()).toBe(0);
    expect(out.join("\n")).toMatch(/rien à migrer/);
  });

  it("une installation qui avait une MariaDB, plus configurée : la commande le dit (code 1)", async () => {
    legacy.url = null;
    writeFileSync(join(secrets, "db_password"), "x");
    expect(await run()).toBe(1);
    expect(out.join("\n")).toMatch(/n'est plus configurée/);
  });

  it("une base SQLite installée sans migration : rien n'est fait, la voie est dite", async () => {
    legacy.url = "mysql://u:p@db/t";
    legacy.state = "never_migrated";
    expect(await run()).toBe(1);
    expect(boot.migrateOnce).not.toHaveBeenCalled();
  });

  it("serveur arrêté : la commande migre elle-même ; un échec dit son motif et que MariaDB est intacte", async () => {
    legacy.url = "mysql://u:p@db/t";
    legacy.state = "pending";
    boot.migrateOnce.mockRejectedValue(new MigrationFailure("source_unreachable", "connexion refusée"));
    expect(await run()).toBe(1);
    expect(out.join("\n")).toMatch(/source_unreachable.*MariaDB est intacte/s);
  });

  it("un serveur vivant mène déjà les essais : la commande lui demande un essai (déclencheur), sans copier elle-même", async () => {
    legacy.url = "mysql://u:p@db/t";
    legacy.state = "pending";
    const paths = migrationPaths(dir);
    // Le serveur, c'est ce processus de test (vivant) — un autre PID que celui qu'on compare : le parent.
    writeFileSync(paths.status, JSON.stringify({ pid: process.ppid, state: "failed", attempt: 1, updatedAt: Date.now(), percent: 0, reason: "source_unreachable" }));
    const pending = runDbMigrateCommand(paths, secrets);
    await new Promise((r) => setTimeout(r, 50));
    expect((await import("fs")).existsSync(paths.trigger)).toBe(true);
    writeFileSync(paths.status, JSON.stringify({ pid: process.ppid, state: "failed", attempt: 2, updatedAt: Date.now(), percent: 0, reason: "disk_space" }));
    expect(await pending).toBe(1);
    expect(boot.migrateOnce).not.toHaveBeenCalled();
  });

  it("un fichier d'état qui ne bat plus n'atteste pas d'un serveur vivant (PID réutilisé)", () => {
    const status = { pid: process.ppid, state: "failed" as const, attempt: 1, percent: 0 };
    expect(serverAlive({ ...status, updatedAt: Date.now() })).toBe(true);
    expect(serverAlive({ ...status, updatedAt: Date.now() - 10 * 60_000 })).toBe(false);
    expect(serverAlive({ ...status, pid: 2 ** 30, updatedAt: Date.now() })).toBe(false);
  });

  it("le rapport en lignes : des noms de tables et des comptes", () => {
    const lines = reportLines(emptySourceReport("1.25.0", { host: "db", port: 3306, database: "tentacle" }, 0, 10));
    expect(lines[0]).toMatch(/installation neuve/);
  });
});
