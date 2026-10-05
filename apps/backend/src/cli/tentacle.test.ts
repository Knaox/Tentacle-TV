import { existsSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ deleted: [] as string[][], completed: false }));
vi.mock("../services/dataDir", async () => {
  const { mkdtempSync } = await import("fs");
  const { tmpdir } = await import("os");
  const { join } = await import("path");
  return { DATA_ROOT: mkdtempSync(join(tmpdir(), "wiz-cli-")) };
});
vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    serverConfig = {
      deleteMany: async ({ where }: { where: { key: { in: string[] } } }) => (h.deleted.push(where.key.in), { count: 3 }),
      findUnique: async () => (h.completed ? { key: "setup_completed", value: "true" } : null),
    };
    async $disconnect(): Promise<void> {}
  },
}));

import { DATA_ROOT } from "../services/dataDir";
import { runCli } from "./tentacle";

const lock = join(DATA_ROOT, "setup-complete");
const token = join(DATA_ROOT, "setup-token.txt");
afterAll(() => rmSync(DATA_ROOT, { recursive: true, force: true }));
beforeEach(() => {
  for (const file of [lock, token]) rmSync(file, { force: true });
  h.deleted.length = 0;
  h.completed = false;
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("tentacle setup", () => {
  it("refuse ce qu'elle ne connaît pas", async () => {
    expect(await runCli([])).toBe(2);
    expect(await runCli(["setup", "open"])).toBe(2);
  });

  it("token : un code neuf tant que l'installation est ouverte", async () => {
    expect(await runCli(["setup", "token"], { DATABASE_URL: "mysql://u:p@db/x" })).toBe(0);
    expect(existsSync(token)).toBe(true);
  });

  it("token : refusé une fois l'installation finie (fichier verrou ou base)", async () => {
    writeFileSync(lock, "x");
    expect(await runCli(["setup", "token"], {})).toBe(1);
    rmSync(lock);
    h.completed = true;
    process.env.DATABASE_URL = "mysql://u:p@db/x";
    expect(await runCli(["setup", "token"], {})).toBe(1);
    delete process.env.DATABASE_URL;
    expect(existsSync(token)).toBe(false);
  });

  it("reset : drapeaux effacés, verrou retiré, code neuf", async () => {
    writeFileSync(lock, "x");
    process.env.DATABASE_URL = "mysql://u:p@db/x";
    expect(await runCli(["setup", "reset"], {})).toBe(0);
    delete process.env.DATABASE_URL;
    expect(h.deleted).toEqual([["setup_completed", "admin_jellyfin_id", "admin_username"]]);
    expect(existsSync(lock)).toBe(false);
    expect(existsSync(token)).toBe(true);
  });

  it("reset sans base : rien n'est touché", async () => {
    writeFileSync(lock, "x");
    expect(await runCli(["setup", "reset"], {})).toBe(1);
    expect(existsSync(lock)).toBe(true);
  });
});
