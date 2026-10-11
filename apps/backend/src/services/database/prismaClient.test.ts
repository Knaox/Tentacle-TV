/**
 * La fermeture de la base à l'arrêt, sur un vrai fichier SQLite : le journal
 * est vidé dans la base, et ce qui a été écrit y reste.
 */

import { existsSync, mkdtempSync, rmSync, statSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyCoreMigrations } from "./migrator";
import { openSqlite } from "./nodeSqlite";
import { closeSqlitePrisma, connectSqlitePrisma } from "./prismaClient";

let folder: string | null = null;

afterEach(() => {
  if (folder) rmSync(folder, { recursive: true, force: true });
  folder = null;
  vi.restoreAllMocks();
});

describe("closeSqlitePrisma", () => {
  it("vide le WAL dans la base, puis rend la connexion", async () => {
    folder = mkdtempSync(join(tmpdir(), "tentacle-close-"));
    const path = join(folder, "tentacle.db");
    applyCoreMigrations(path);
    const client = await connectSqlitePrisma(path);
    await client.serverConfig.create({ data: { key: "close_test", value: "écrit avant l'arrêt" } });
    expect(statSync(`${path}-wal`).size).toBeGreaterThan(0);

    await closeSqlitePrisma(client);

    const wal = `${path}-wal`;
    expect(!existsSync(wal) || statSync(wal).size === 0).toBe(true);
    const db = openSqlite(path, { readOnly: true });
    try {
      expect(db.prepare("SELECT value FROM server_config WHERE key = 'close_test'").get()).toEqual({ value: "écrit avant l'arrêt" });
    } finally {
      db.close();
    }
  });

  it("un point de contrôle en échec n'empêche pas la fermeture", async () => {
    const disconnect = vi.fn(async () => undefined);
    const client = { $queryRawUnsafe: vi.fn(async () => { throw new Error("busy"); }), $disconnect: disconnect };
    const log = vi.fn();
    await closeSqlitePrisma(client as unknown as Parameters<typeof closeSqlitePrisma>[0], log);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("busy"));
  });
});
