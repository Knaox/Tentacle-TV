import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

/**
 * Un dossier jetable pour une VRAIE base SQLite de test : `use()` rend un
 * chemin neuf, `cleanup()` efface tout (base, `-wal`, `-shm`).
 */
export function tempDatabaseDir(prefix = "tentacle-sqlite-test-"): { use: (name?: string) => string; dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  let count = 0;
  return {
    dir,
    use: (name?: string) => join(dir, name ?? `db-${++count}.db`),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
