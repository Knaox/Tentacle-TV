import { unlinkSync } from "fs";
import type { DatabaseSync } from "node:sqlite";
import { openSqlite } from "../services/database/nodeSqlite";
import { createPrivateFile, refuseSymlink } from "./migrationFiles";

/**
 * UN SEUL copieur à la fois : le serveur (mode maintenance) ou la CLI
 * (`tentacle db migrate`). Le verrou est celui du NOYAU, pas un PID : le fichier
 * `data/db-migration.lock` est une petite base SQLite que le copieur ouvre et tient
 * en `BEGIN EXCLUSIVE` toute la copie durant. Un concurrent l'ouvre, sans attente
 * (`busy_timeout = 0`), et reçoit SQLITE_BUSY : « un copieur vit ».
 *
 * Pourquoi pas un PID (trouvé au banc, puis à l'audit) : dans un conteneur le serveur
 * a TOUJOURS le PID 2 ; deux conteneurs sur le même volume (mise à jour « start-first »,
 * deux piles qui partagent un volume) ont tous deux ce PID ; et la reprise d'un verrou
 * périmé est une course. Le verrou du noyau (fcntl) :
 * - est rendu par le noyau à la mort du processus (kill -9, docker kill) — rien à
 *   reprendre, donc plus de course ;
 * - vaut d'un espace de PID à l'autre sur le même noyau, et sous Windows comme sous macOS.
 * Le fichier d'état (`migrationLoop.ts`) garde le PID et le battement, pour la CLI.
 */
export interface MigrationLock {
  release(): void;
}

export function processAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM : le processus existe, sous un autre compte.
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

function sqliteCode(err: unknown): string {
  const e = err as { code?: unknown; errstr?: unknown; message?: unknown };
  return `${String(e?.code ?? "")} ${String(e?.errstr ?? "")} ${String(e?.message ?? "")}`;
}

function takeExclusive(path: string): DatabaseSync | "busy" {
  createPrivateFile(path);
  const db = openSqlite(path, { foreignKeys: false });
  try {
    db.exec("PRAGMA busy_timeout = 0");
    db.exec("BEGIN EXCLUSIVE");
    return db;
  } catch (err) {
    db.close();
    if (/SQLITE_BUSY|SQLITE_LOCKED|database is locked/i.test(sqliteCode(err))) return "busy";
    throw err;
  }
}

/** Le verrou, ou `null` si un autre copieur (processus ou conteneur) le tient. */
export function tryAcquireLock(path: string): MigrationLock | null {
  refuseSymlink(path);
  let taken: DatabaseSync | "busy";
  try {
    taken = takeExclusive(path);
  } catch (err) {
    // Un verrou d'une version de développement (un PID en texte) : ce n'est pas une
    // base, personne ne peut le tenir au sens du noyau — il est remplacé, une fois.
    if (!/SQLITE_NOTADB|not a database|file is not a database/i.test(sqliteCode(err))) throw err;
    unlinkSync(path);
    taken = takeExclusive(path);
  }
  if (taken === "busy") return null;
  const db = taken;
  let released = false;
  return {
    release: () => {
      if (released) return;
      released = true;
      try {
        db.exec("ROLLBACK");
      } catch {
        /* rien d'écrit dans la transaction : rien à annuler */
      }
      db.close();
    },
  };
}
