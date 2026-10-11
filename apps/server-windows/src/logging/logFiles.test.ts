import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LogFiles, expiredLogs, logFileName } from "./logFiles";

describe("noms et rotation", () => {
  it("nomme le fichier par la date locale", () => {
    expect(logFileName(new Date(2026, 0, 5, 23, 59))).toBe("server-2026-01-05.log");
  });

  it("garde sept jours, aujourd'hui compris, et ignore les autres fichiers", () => {
    const today = new Date(2026, 9, 11, 8);
    const names = ["server-2026-10-11.log", "server-2026-10-05.log", "server-2026-10-04.log", "server-2025-12-31.log", "notes.txt"];
    expect(expiredLogs(names, today)).toEqual(["server-2026-10-04.log", "server-2025-12-31.log"]);
  });
});

describe("LogFiles", () => {
  let dir = "";
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("écrit l'hôte et le serveur dans le fichier du jour, et fait le ménage en changeant de jour", () => {
    dir = mkdtempSync(join(tmpdir(), "host-logs-"));
    writeFileSync(join(dir, "server-2026-10-01.log"), "vieux\n");
    let now = new Date(2026, 9, 7, 10);
    const logs = new LogFiles(dir, () => now);
    logs.host("démarrage");
    logs.server('{"msg":"Server listening"}');
    const first = readFileSync(join(dir, "server-2026-10-07.log"), "utf8");
    expect(first).toContain("[hôte] démarrage");
    expect(first).toContain('{"msg":"Server listening"}\n');
    expect(readdirSync(dir)).toContain("server-2026-10-01.log");

    now = new Date(2026, 9, 8, 0, 1);
    logs.host("minuit passé");
    expect(readdirSync(dir).sort()).toEqual(["server-2026-10-07.log", "server-2026-10-08.log"]);
  });
});
