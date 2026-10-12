import { lstatSync, mkdirSync, unlinkSync } from "fs";
import { resolve } from "path";
import type { DatabaseSync } from "node:sqlite";
import { DATA_ROOT } from "../dataDir";
import { openSqlite } from "../database/nodeSqlite";

/**
 * UN serveur par dossier de données. Tout s'initialise avant l'écoute — code
 * d'installation réécrit, tâches de fond, extensions — : un second serveur sur
 * les mêmes données invalidait le code et doublait les tâches avant de mourir
 * sur le port. Vrai d'un double lancement sous Windows comme de deux conteneurs
 * sur un même volume.
 *
 * Même verrou que la migration (`dbMigration/migrationLock.ts`, qui partira avec
 * MariaDB) : une petite base SQLite tenue en `BEGIN EXCLUSIVE` toute la vie du
 * processus. Le système le rend à la mort du processus, même tué : aucun PID
 * périmé à reprendre. Jamais `tentacle.db` : Prisma l'ouvre dans ce processus.
 */
export const SERVER_LOCK_FILE = "server.lock";

export type ServerLockOutcome =
  | { held: true; release: () => void }
  | { held: false; reason: "already_running" | "data_dir_unwritable"; detail: string };

export interface ServerLockOptions {
  /** Le temps d'attendre un serveur qui s'arrête (relance rapide, `tsx watch`). */
  waitMs: number;
  pollMs: number;
}

const DEFAULT_OPTIONS: ServerLockOptions = { waitMs: 10_000, pollMs: 250 };
const BUSY = /SQLITE_BUSY|SQLITE_LOCKED|database is locked/i;
const NOT_A_DATABASE = /SQLITE_NOTADB|not a database/i;
const UNWRITABLE = /EACCES|EPERM|EROFS|SQLITE_CANTOPEN|SQLITE_READONLY|unable to open|readonly/i;

/** Tenu au niveau du module : un verrou ramassé par le GC serait un verrou rendu. */
let held: DatabaseSync | null = null;

function describe(error: unknown): string {
  const e = error as { code?: unknown; errstr?: unknown; message?: unknown };
  return `${String(e?.code ?? "")} ${String(e?.errstr ?? "")} ${String(e?.message ?? "")}`.trim();
}

function take(path: string): DatabaseSync | "busy" {
  const db = openSqlite(path, { foreignKeys: false });
  try {
    db.exec("PRAGMA busy_timeout = 0");
    db.exec("BEGIN EXCLUSIVE");
    return db;
  } catch (error) {
    db.close();
    if (BUSY.test(describe(error))) return "busy";
    throw error;
  }
}

function attempt(path: string): DatabaseSync | "busy" {
  try {
    return take(path);
  } catch (error) {
    // Ce n'est pas une base (fichier abîmé, posé à la main) : personne ne peut le tenir, il est remplacé.
    if (!NOT_A_DATABASE.test(describe(error))) throw error;
    unlinkSync(path);
    return take(path);
  }
}

export async function acquireServerLock(dataRoot: string = DATA_ROOT, options: ServerLockOptions = DEFAULT_OPTIONS): Promise<ServerLockOutcome> {
  const path = resolve(dataRoot, SERVER_LOCK_FILE);
  const since = Date.now();
  for (;;) {
    let taken: DatabaseSync | "busy";
    try {
      mkdirSync(dataRoot, { recursive: true });
      if (lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error(`EPERM: ${SERVER_LOCK_FILE} est un lien symbolique`);
      taken = attempt(path);
    } catch (error) {
      const detail = describe(error);
      if (UNWRITABLE.test(detail)) return { held: false, reason: "data_dir_unwritable", detail: `${dataRoot} : ${detail}` };
      throw error;
    }
    if (taken !== "busy") {
      held = taken;
      return { held: true, release: () => releaseServerLock(taken) };
    }
    if (Date.now() - since >= options.waitMs) {
      return { held: false, reason: "already_running", detail: `un autre serveur Tentacle utilise déjà ${dataRoot}` };
    }
    await new Promise((done) => setTimeout(done, options.pollMs));
  }
}

function releaseServerLock(db: DatabaseSync): void {
  if (held !== db) return;
  held = null;
  try {
    db.exec("ROLLBACK");
  } catch {
    /* rien d'écrit dans la transaction : rien à annuler */
  }
  db.close();
}
