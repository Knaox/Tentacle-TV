import { chmodSync, closeSync, existsSync, fsyncSync, lstatSync, openSync, renameSync, statfsSync, unlinkSync } from "fs";
import { dirname } from "path";
import { MigrationFailure } from "./migrationErrors";

/**
 * Les fichiers de la migration, à côté de `tentacle.db` : la copie en cours
 * (`.migrating`), une base mise de côté (`.bak`), le rapport. Tous portent les
 * secrets du serveur (jwt_secret, clés) : 0600, créés AVANT la première
 * ouverture (audit S4), jamais par `process.umask`. Un lien symbolique à leur
 * place est REFUSÉ (audit SC2) : `open`, `chmod` et `rename` le suivraient.
 */
export const MIGRATING_SUFFIX = ".migrating";
const SIDECARS = ["", "-wal", "-shm", "-journal"];

export function migratingPath(finalPath: string): string {
  return `${finalPath}${MIGRATING_SUFFIX}`;
}

/** Un `.bak` daté : jamais écrasé, jamais deux fois le même nom. */
export function backupPath(finalPath: string, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\..*$/, "").replace("T", "-");
  let candidate = `${finalPath}.${stamp}.bak`;
  for (let n = 2; existsSync(candidate); n++) candidate = `${finalPath}.${stamp}-${n}.bak`;
  return candidate;
}

/** Lève si le chemin est un lien symbolique (absent : rien à dire). */
export function refuseSymlink(path: string): void {
  const link = (() => {
    try {
      return lstatSync(path).isSymbolicLink();
    } catch {
      return false; // absent
    }
  })();
  if (link) throw new MigrationFailure("unsafe_path", `${path} est un lien symbolique : refusé`);
}

export function refuseSymlinks(base: string): void {
  for (const suffix of SIDECARS) refuseSymlink(`${base}${suffix}`);
}

/** Crée le fichier en 0600 s'il n'existe pas, et ramène à 0600 celui qui existe. */
export function createPrivateFile(path: string): void {
  refuseSymlink(path);
  closeSync(openSync(path, "a", 0o600));
  restrictToOwner(path);
}

export function restrictToOwner(path: string): void {
  try {
    chmodSync(path, 0o600);
  } catch {
    /* Windows, ou fichier d'un autre propriétaire : le serveur le lit quand même */
  }
}

/** Supprime une copie interrompue et ses fichiers annexes — c'est un brouillon. */
export function removeDraft(base: string): void {
  for (const suffix of SIDECARS) {
    const file = `${base}${suffix}`;
    refuseSymlink(file);
    if (existsSync(file)) unlinkSync(file);
  }
}

/** Déplace une base (et son WAL) sous un autre nom, en 0600. */
export function moveDatabase(from: string, to: string): void {
  refuseSymlinks(from);
  refuseSymlinks(to);
  for (const suffix of ["-wal", "-shm"]) {
    if (existsSync(`${from}${suffix}`)) renameSync(`${from}${suffix}`, `${to}${suffix}`);
  }
  renameSync(from, to);
  for (const suffix of ["", "-wal", "-shm"]) if (existsSync(`${to}${suffix}`)) restrictToOwner(`${to}${suffix}`);
}

/** Écrit sur le disque ce qui est en cache, puis le renommage dans son dossier (durable). */
export function syncFile(path: string): void {
  const fd = openSync(path, "r+");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

export function syncDirectory(path: string): void {
  try {
    const fd = openSync(dirname(path), "r");
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  } catch {
    /* Windows n'ouvre pas un dossier : le renommage y est déjà durable */
  }
}

/** Octets libres pour le serveur dans le dossier de données. */
export function freeBytes(dir: string): number {
  const s = statfsSync(dir);
  return Number(s.bavail) * Number(s.bsize);
}

/**
 * La place exigée AVANT de commencer : la taille de la source (données et index,
 * ce que MariaDB en dit), plus un dixième et 100 Mo de marge. Mesuré sur une
 * vraie base : 849 Mo dans MariaDB, 732 Mo dans SQLite.
 */
export function requiredBytes(sourceBytes: number): number {
  return Math.ceil(sourceBytes * 1.1) + 100 * 1024 * 1024;
}
