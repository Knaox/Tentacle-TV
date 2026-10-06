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
import { normalizeArgs, runCli } from "./tentacle";

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
  it("refuse ce qu'elle ne connaît pas, en redonnant l'usage complet", async () => {
    expect(await runCli([])).toBe(2);
    expect(await runCli(["setup", "open"])).toBe(2);
    const said = vi.mocked(console.error).mock.calls.flat().join("\n");
    expect(said).toContain("Commande inconnue / unknown command : tentacle setup open");
    expect(said).toContain("tentacle setup token   affiche un code d'installation neuf");
    expect(said).toContain("tentacle setup reset");
  });

  it("l'aide se demande, et répond sans erreur", async () => {
    expect(await runCli(["--help"])).toBe(0);
    expect(await runCli(["tentacle", "help"])).toBe(0);
    expect(vi.mocked(console.log).mock.calls.flat().join("\n")).toContain("print a new one-time setup code");
  });

  it("`tentacle tentacle setup token` est pardonné : le nom tapé deux fois est ignoré", async () => {
    expect(normalizeArgs(["tentacle", "setup", "token"])).toEqual(["setup", "token"]);
    expect(normalizeArgs(["Tentacle", "tentacle", "SETUP", "Token"])).toEqual(["setup", "token"]);
    expect(await runCli(["tentacle", "setup", "token"], {})).toBe(0);
    expect(existsSync(token)).toBe(true);
    expect(vi.mocked(console.log).mock.calls.flat().join("\n")).toMatch(/[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}/);
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

  it("reset : drapeaux effacés, verrou retiré, et aucun code — le redémarrage en écrit un", async () => {
    writeFileSync(lock, "x");
    writeFileSync(token, "AAAA-BBBB-CCCC\n");
    process.env.DATABASE_URL = "mysql://u:p@db/x";
    expect(await runCli(["setup", "reset"], {})).toBe(0);
    delete process.env.DATABASE_URL;
    expect(h.deleted).toEqual([["setup_completed", "admin_jellyfin_id", "admin_username"]]);
    expect(existsSync(lock)).toBe(false);
    expect(existsSync(token)).toBe(false);
    const printed = vi.mocked(console.log).mock.calls.flat().join("\n");
    expect(printed).toContain("Redémarrez le serveur");
    expect(printed).not.toContain("docker compose");
    expect(printed).not.toMatch(/[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}/);
  });

  it("reset sans base : rien n'est touché", async () => {
    writeFileSync(lock, "x");
    expect(await runCli(["setup", "reset"], {})).toBe(1);
    expect(existsSync(lock)).toBe(true);
  });
});
