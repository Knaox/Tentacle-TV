import { closeSync, openSync, readFileSync, unlinkSync, writeSync } from "fs";
import { refuseSymlink } from "./migrationFiles";

/**
 * UN SEUL copieur à la fois : le serveur (mode maintenance) ou la CLI
 * (`tentacle db migrate`, lancée sur une installation native serveur arrêté).
 * Un fichier créé en exclusif (`wx`, 0600) porte le PID du détenteur et l'heure
 * de démarrage de ce processus ; un détenteur mort (arrêt brutal) ne bloque
 * personne : son verrou est repris.
 *
 * Le PID seul ne suffit pas (trouvé au banc, arrêt brutal en pleine copie) : dans
 * un conteneur, le serveur a TOUJOURS le même PID (2, sous tini). Après un
 * `docker kill`, le serveur redémarré lisait le PID du verrou laissé… le sien, se
 * croyait devancé par « une autre migration », et ne migrait plus jamais. D'où :
 * - le PID du processus courant, quand celui-ci ne tient pas le verrou, est
 *   celui d'une vie d'avant : verrou périmé ;
 * - un PID vivant dont l'heure de démarrage diffère de celle notée a été repris
 *   par un autre processus : verrou périmé.
 *
 * Sous Docker, la CLI tourne par `docker exec` dans le même espace de PID que
 * le serveur : elle voit qu'il vit, et lui demande un essai au lieu de copier.
 */
export interface MigrationLock {
  release(): void;
}

/** Les verrous que CE processus tient (chemin → oui). */
const held = new Set<string>();

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

/** L'heure de démarrage d'un processus (Linux : `/proc/<pid>/stat`, champ 22), ou `null` ailleurs. */
export function processStartTicks(pid: number): string | null {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf-8");
    // Le nom du programme (champ 2) peut contenir des espaces : on repart après sa parenthèse.
    const fields = stat.slice(stat.lastIndexOf(")") + 2).trim().split(" ");
    return fields[19] ?? null;
  } catch {
    return null;
  }
}

/** Le PID du détenteur VIVANT du verrou, ou `null` (absent, mort, ou d'une vie d'avant). */
export function lockHolder(path: string, self = process.pid): number | null {
  try {
    const [pidText, ticks] = readFileSync(path, "utf-8").trim().split(/\s+/);
    const pid = Number(pidText);
    if (pid === self) return held.has(path) ? pid : null;
    if (!processAlive(pid)) return null;
    // Un verrou d'avant ce correctif (PID seul) : prudence, le détenteur est tenu pour vivant.
    if (ticks) {
      const now = processStartTicks(pid);
      if (now !== null && now !== ticks) return null;
    }
    return pid;
  } catch {
    return null;
  }
}

export function tryAcquireLock(path: string, pid = process.pid): MigrationLock | null {
  refuseSymlink(path);
  if (held.has(path)) return null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(path, "wx", 0o600);
      writeSync(fd, `${pid} ${processStartTicks(pid) ?? ""}`.trim() + "\n");
      closeSync(fd);
      held.add(path);
      return {
        release: () => {
          held.delete(path);
          try {
            if (readFileSync(path, "utf-8").trim().split(/\s+/)[0] === String(pid)) unlinkSync(path);
          } catch {
            /* déjà rendu */
          }
        },
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      if (lockHolder(path, pid) !== null) return null;
      // Détenteur mort, ou d'une vie d'avant : le verrou est repris.
      try {
        unlinkSync(path);
      } catch {
        /* repris par un autre entre-temps */
      }
    }
  }
  return null;
}
