import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const restart = vi.hoisted(() => ({ requestServerRestart: vi.fn() }));
vi.mock("../services/pluginRestart", () => ({ requestServerRestart: restart.requestServerRestart, BOOT_ID: "test" }));

import { consumeRemigrationRequest, REMIGRATE_REQUEST_FILE, requestRemigration } from "./postMigration";

let dir: string;
const env = { ...process.env };
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tentacle-remig-"));
  restart.requestServerRestart.mockReset();
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  process.env = { ...env };
});

describe("remigration à la demande — jamais à chaud", () => {
  it("la demande pose un marqueur 0600 puis un redémarrage CONTRÔLÉ", () => {
    requestRemigration(dir);
    expect(statSync(join(dir, REMIGRATE_REQUEST_FILE)).mode & 0o777).toBe(0o600);
    expect(restart.requestServerRestart).toHaveBeenCalledTimes(1);
  });

  it("au démarrage suivant, la base actuelle part en .bak daté (0600), et la migration repart de l'ancienne base", () => {
    process.env.DATABASE_URL = "mysql://u:p@db:3306/tentacle";
    writeFileSync(join(dir, "tentacle.db"), "base actuelle", { mode: 0o644 });
    writeFileSync(join(dir, REMIGRATE_REQUEST_FILE), "");
    expect(consumeRemigrationRequest(dir, () => undefined)).toBe(true);
    expect(existsSync(join(dir, "tentacle.db"))).toBe(false);
    const bak = readdirSync(dir).find((f) => /^tentacle\.db\.\d{8}-\d{6}\.bak$/.test(f))!;
    expect(statSync(join(dir, bak)).mode & 0o777).toBe(0o600);
    expect(existsSync(join(dir, REMIGRATE_REQUEST_FILE))).toBe(false);
  });

  it("sans ancienne base configurée, la demande est ignorée et la base n'est pas touchée", () => {
    delete process.env.DATABASE_URL;
    delete process.env.DB_HOST;
    writeFileSync(join(dir, "tentacle.db"), "base actuelle");
    writeFileSync(join(dir, REMIGRATE_REQUEST_FILE), "");
    expect(consumeRemigrationRequest(dir, () => undefined)).toBe(false);
    expect(existsSync(join(dir, "tentacle.db"))).toBe(true);
  });

  it("sans demande, rien ne bouge", () => {
    writeFileSync(join(dir, "tentacle.db"), "base actuelle");
    expect(consumeRemigrationRequest(dir, () => undefined)).toBe(false);
    expect(existsSync(join(dir, "tentacle.db"))).toBe(true);
  });
});
