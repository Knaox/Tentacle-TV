import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { tryAcquireLock } from "./migrationLock";

/**
 * Le verrou de migration est celui du NOYAU (une base SQLite tenue en BEGIN EXCLUSIVE),
 * jamais un PID : trouvé au banc (le serveur d'un conteneur a toujours le PID 2), et à
 * l'audit (deux conteneurs sur un même volume, une reprise de verrou périmé en course).
 * Des processus RÉELS, pas des simulations.
 */
const BACKEND = resolve(__dirname, "../..");
let dir: string;
let lockPath: string;
const children: ChildProcess[] = [];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tentacle-lock-"));
  lockPath = join(dir, "db-migration.lock");
});
afterEach(() => {
  for (const child of children.splice(0)) child.kill("SIGKILL");
  rmSync(dir, { recursive: true, force: true });
});

/** Un copieur dans son propre processus ; rend sa première ligne (« acquired » ou « busy »). */
function copier(holdMs: number): Promise<{ child: ChildProcess; said: string }> {
  const child = spawn(process.execPath, ["--import", "tsx", "test/lockHolderChild.ts", lockPath, String(holdMs)], { cwd: BACKEND, stdio: ["ignore", "pipe", "ignore"] });
  children.push(child);
  return new Promise((resolvePromise, reject) => {
    let out = "";
    child.stdout!.on("data", (chunk) => {
      out += String(chunk);
      if (out.includes("\n")) resolvePromise({ child, said: out.trim() });
    });
    child.on("exit", (code) => (out.includes("\n") ? undefined : reject(new Error(`copieur arrêté (code ${code}) sans rien dire`))));
  });
}
const exited = (child: ChildProcess) => new Promise<void>((r) => (child.exitCode !== null || child.signalCode !== null ? r() : child.on("exit", () => r())));

describe("le verrou de migration (noyau)", () => {
  it("tenu par un autre copieur VIVANT — même PID ou non, peu importe : le second n'obtient rien tant que le premier vit", async () => {
    const first = await copier(60_000);
    expect(first.said).toBe("acquired");
    expect(tryAcquireLock(lockPath)).toBeNull();
    const second = await copier(60_000);
    expect(second.said).toBe("busy");
  }, 30_000);

  it("un copieur tué par SIGKILL (docker kill, coupure) : le noyau rend le verrou, la reprise le prend", async () => {
    const first = await copier(60_000);
    expect(first.said).toBe("acquired");
    first.child.kill("SIGKILL");
    await exited(first.child);
    const lock = tryAcquireLock(lockPath);
    expect(lock).not.toBeNull();
    lock!.release();
  }, 30_000);

  it("deux copieurs réels lancés ensemble : un seul copie", async () => {
    const both = await Promise.all([copier(3_000), copier(3_000)]);
    expect(both.map((c) => c.said).sort()).toEqual(["acquired", "busy"]);
  }, 30_000);

  it("dans le même processus : un second essai attend son tour, puis passe une fois le verrou rendu", () => {
    const lock = tryAcquireLock(lockPath);
    expect(lock).not.toBeNull();
    expect(tryAcquireLock(lockPath)).toBeNull();
    lock!.release();
    const again = tryAcquireLock(lockPath);
    expect(again).not.toBeNull();
    again!.release();
  });

  it("un verrou d'une version de développement (un PID en texte) : remplacé ; un lien symbolique : refusé", () => {
    writeFileSync(lockPath, "2 12345\n");
    const lock = tryAcquireLock(lockPath);
    expect(lock).not.toBeNull();
    lock!.release();
    const link = join(dir, "lien.lock");
    symlinkSync(lockPath, link);
    expect(() => tryAcquireLock(link)).toThrow();
  });
});
