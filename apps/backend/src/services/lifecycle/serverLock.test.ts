/**
 * Le verrou d'instance, sur un vrai dossier : un second serveur (ici un second
 * verrou du même processus, que SQLite voit comme une autre connexion) est
 * refusé ; rendu, le verrou se reprend.
 */

import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import { acquireServerLock, SERVER_LOCK_FILE } from "./serverLock";

const FAST = { waitMs: 300, pollMs: 50 };
let folder: string | null = null;

afterEach(() => {
  if (folder) rmSync(folder, { recursive: true, force: true });
  folder = null;
});

function tempDir(): string {
  folder = mkdtempSync(join(tmpdir(), "tentacle-lock-"));
  return folder;
}

describe("acquireServerLock", () => {
  it("un second serveur sur les mêmes données est refusé, puis passe une fois le premier parti", async () => {
    const dir = tempDir();
    const first = await acquireServerLock(dir, FAST);
    expect(first.held).toBe(true);
    const second = await acquireServerLock(dir, FAST);
    expect(second).toMatchObject({ held: false, reason: "already_running" });
    if (first.held) first.release();
    const third = await acquireServerLock(dir, FAST);
    expect(third.held).toBe(true);
    if (third.held) third.release();
  });

  it("attend un serveur qui s'arrête au lieu d'échouer aussitôt", async () => {
    const dir = tempDir();
    const first = await acquireServerLock(dir, FAST);
    if (!first.held) throw new Error("verrou attendu");
    setTimeout(() => first.release(), 100);
    const second = await acquireServerLock(dir, { waitMs: 2000, pollMs: 25 });
    expect(second.held).toBe(true);
    if (second.held) second.release();
  });

  it("crée le dossier de données s'il n'existe pas encore", async () => {
    const dir = join(tempDir(), "Tentacle Server", "données");
    const lock = await acquireServerLock(dir, FAST);
    expect(lock.held).toBe(true);
    if (lock.held) lock.release();
  });

  it("un fichier qui n'est pas une base est remplacé", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, SERVER_LOCK_FILE), "1234\n".repeat(40));
    const lock = await acquireServerLock(dir, FAST);
    expect(lock.held).toBe(true);
    if (lock.held) lock.release();
  });
});
