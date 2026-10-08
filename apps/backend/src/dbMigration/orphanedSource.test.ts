import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { orphanedLegacyInstallation } from "./orphanedSource";
import { migrationFailed, migrationFinished, publicDatabaseState } from "./migrationState";

let root: string;
let data: string;
let secrets: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "tentacle-orphan-"));
  data = join(root, "data");
  secrets = join(root, "secrets");
  mkdirSync(data);
  mkdirSync(secrets);
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  migrationFinished();
});

describe("une installation qui avait une MariaDB, plus configurée — jamais une base vide à sa place", () => {
  it("installation neuve (rien) : pas orpheline, la base naît", () => {
    expect(orphanedLegacyInstallation(null, data, secrets)).toBe(false);
  });

  it("pile officielle mise à jour trop tôt : le secret db_password de l'ancienne pile la trahit", () => {
    writeFileSync(join(secrets, "db_password"), "x");
    expect(orphanedLegacyInstallation(null, data, secrets)).toBe(true);
  });

  it("installation scellée (1.24+) sans base ni source : orpheline", () => {
    writeFileSync(join(data, "setup-complete"), "");
    expect(orphanedLegacyInstallation(null, data, secrets)).toBe(true);
  });

  it("une source configurée (la migration s'en charge) ou une tentacle.db déjà là : pas orpheline", () => {
    writeFileSync(join(secrets, "db_password"), "x");
    expect(orphanedLegacyInstallation("mysql://u:p@db/t", data, secrets)).toBe(false);
    writeFileSync(join(data, "tentacle.db"), "");
    expect(orphanedLegacyInstallation(null, data, secrets)).toBe(false);
  });

  it("l'état public dit le motif, sans « nouvel essai » trompeur", () => {
    migrationFailed("source_missing", null);
    const db = publicDatabaseState();
    expect(db).toMatchObject({ state: "failed", reason: "source_missing" });
    expect("retryInSeconds" in db).toBe(false);
  });
});
