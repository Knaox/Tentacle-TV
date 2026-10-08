import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { runDbStartFresh } from "./dbStartFreshCommand";
import { FRESH_START_FILE, orphanedLegacyInstallation } from "../dbMigration/orphanedSource";

let data: string;
let secrets: string;
const env = { ...process.env };
beforeEach(() => {
  data = mkdtempSync(join(tmpdir(), "tentacle-fresh-data-"));
  secrets = mkdtempSync(join(tmpdir(), "tentacle-fresh-secrets-"));
  delete process.env.DATABASE_URL;
  delete process.env.DB_HOST;
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => {
  rmSync(data, { recursive: true, force: true });
  rmSync(secrets, { recursive: true, force: true });
  process.env = { ...env };
  vi.restoreAllMocks();
});

describe("tentacle db start-fresh — la porte de sortie de source_missing", () => {
  it("rien à faire sur un serveur qui n'attend pas d'ancienne base", () => {
    expect(runDbStartFresh(["--confirm"], data, secrets)).toBe(0);
    expect(existsSync(join(data, FRESH_START_FILE))).toBe(false);
  });

  it("sans --confirm : rien n'est fait, la commande dit ce qu'elle ferait", () => {
    writeFileSync(join(secrets, "db_password"), "x");
    expect(runDbStartFresh([], data, secrets)).toBe(2);
    expect(existsSync(join(data, FRESH_START_FILE))).toBe(false);
  });

  it("avec --confirm : marqueur 0600, assistant rouvert, et l'installation n'est plus tenue", () => {
    writeFileSync(join(secrets, "db_password"), "x");
    writeFileSync(join(data, "setup-complete"), "");
    expect(orphanedLegacyInstallation(null, data, secrets)).toBe(true);
    expect(runDbStartFresh(["--confirm"], data, secrets)).toBe(0);
    expect(statSync(join(data, FRESH_START_FILE)).mode & 0o777).toBe(0o600);
    expect(existsSync(join(data, "setup-complete"))).toBe(false);
    expect(orphanedLegacyInstallation(null, data, secrets)).toBe(false);
  });
});
