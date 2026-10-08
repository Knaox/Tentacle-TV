import { closeSync, openSync, readFileSync, unlinkSync, writeSync } from "fs";
import { refuseSymlink } from "./migrationFiles";

/**
 * UN SEUL copieur à la fois : le serveur (mode maintenance) ou la CLI
 * (`tentacle db migrate`, lancée sur une installation native serveur arrêté).
 * Un fichier créé en exclusif (`wx`, 0600) porte le PID du détenteur ; un
 * détenteur mort (arrêt brutal) ne bloque personne : son verrou est repris.
 *
 * Sous Docker, la CLI tourne par `docker exec` dans le même espace de PID que
 * le serveur : elle voit qu'il vit, et lui demande un essai au lieu de copier.
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

/** Le PID du détenteur vivant du verrou, ou `null`. */
export function lockHolder(path: string): number | null {
  try {
    const pid = Number(readFileSync(path, "utf-8").trim());
    return processAlive(pid) ? pid : null;
  } catch {
    return null;
  }
}

export function tryAcquireLock(path: string, pid = process.pid): MigrationLock | null {
  refuseSymlink(path);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(path, "wx", 0o600);
      writeSync(fd, `${pid}\n`);
      closeSync(fd);
      return {
        release: () => {
          try {
            if (readFileSync(path, "utf-8").trim() === String(pid)) unlinkSync(path);
          } catch {
            /* déjà rendu */
          }
        },
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      if (lockHolder(path) !== null) return null;
      // Détenteur mort : le verrou est repris.
      try {
        unlinkSync(path);
      } catch {
        /* repris par un autre entre-temps */
      }
    }
  }
  return null;
}
