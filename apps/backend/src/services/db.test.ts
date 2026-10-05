import { readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./dataDir", async () => {
  const { mkdtempSync } = await import("fs");
  const { tmpdir } = await import("os");
  const { join } = await import("path");
  return { DATA_ROOT: mkdtempSync(join(tmpdir(), "wiz-db-")) };
});

import { DATA_ROOT } from "./dataDir";
import { saveDatabaseUrl } from "./db";

const file = join(DATA_ROOT, "database.json");
const before = process.env.DATABASE_URL;
afterEach(() => {
  if (before === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = before;
});
afterAll(() => rmSync(DATA_ROOT, { recursive: true, force: true }));

describe("saveDatabaseUrl", () => {
  it("écrit data/database.json lisible du seul compte du serveur", () => {
    saveDatabaseUrl("mysql://u:p@db:3306/tentacle");
    expect(JSON.parse(readFileSync(file, "utf-8"))).toEqual({ url: "mysql://u:p@db:3306/tentacle" });
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(process.env.DATABASE_URL).toBe("mysql://u:p@db:3306/tentacle");
  });

  it("resserre un fichier d'avant, lisible de tous", () => {
    writeFileSync(file, "{}", { mode: 0o644 });
    saveDatabaseUrl("mysql://u:p@db:3306/autre");
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });
});
