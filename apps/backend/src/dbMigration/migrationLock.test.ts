import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { lockHolder, processStartTicks, tryAcquireLock } from "./migrationLock";

/**
 * Le verrou de migration après un arrêt brutal. Trouvé au banc : dans un conteneur, le
 * serveur redémarré a le MÊME PID que celui qu'on a tué (2, sous tini) ; avec le PID seul,
 * il lisait son propre numéro dans le verrou laissé et ne migrait plus jamais.
 */
let dir: string;
let lockPath: string;
let other: ChildProcess | null = null;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tentacle-lock-"));
  lockPath = join(dir, "db-migration.lock");
});
afterEach(() => {
  other?.kill();
  other = null;
  rmSync(dir, { recursive: true, force: true });
});

function liveOtherProcess(): number {
  other = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { stdio: "ignore" });
  return other.pid!;
}

describe("le verrou de migration", () => {
  it("laissé par la vie d'AVANT du conteneur, au même PID que le serveur redémarré : repris", () => {
    writeFileSync(lockPath, `${process.pid} 12345\n`);
    const lock = tryAcquireLock(lockPath);
    expect(lock).not.toBeNull();
    expect(readFileSync(lockPath, "utf-8").trim().split(" ")[0]).toBe(String(process.pid));
    lock!.release();
    expect(existsSync(lockPath)).toBe(false);
  });

  it("au format d'avant (PID seul), même PID : repris aussi", () => {
    writeFileSync(lockPath, `${process.pid}\n`);
    expect(tryAcquireLock(lockPath)).not.toBeNull();
  });

  it("tenu par un AUTRE processus vivant (la CLI) : refusé, et son PID est dit", () => {
    const pid = liveOtherProcess();
    const ticks = processStartTicks(pid);
    writeFileSync(lockPath, `${pid} ${ticks ?? ""}`.trim() + "\n");
    expect(tryAcquireLock(lockPath)).toBeNull();
    expect(lockHolder(lockPath)).toBe(pid);
  });

  it.skipIf(process.platform !== "linux")("un PID vivant mais REPRIS par un autre processus (heure de démarrage différente) : repris", () => {
    const pid = liveOtherProcess();
    writeFileSync(lockPath, `${pid} 1\n`);
    expect(lockHolder(lockPath)).toBeNull();
    expect(tryAcquireLock(lockPath)).not.toBeNull();
  });

  it("d'un processus mort : repris", () => {
    writeFileSync(lockPath, "999999 1\n");
    expect(tryAcquireLock(lockPath)).not.toBeNull();
  });

  it("déjà tenu par CE processus : un second essai attend son tour", () => {
    const lock = tryAcquireLock(lockPath);
    expect(lock).not.toBeNull();
    expect(tryAcquireLock(lockPath)).toBeNull();
    expect(lockHolder(lockPath)).toBe(process.pid);
    lock!.release();
    expect(tryAcquireLock(lockPath)).not.toBeNull();
  });
});
