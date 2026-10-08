import { mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

/**
 * Le dossier de données des TESTS : un dossier temporaire neuf par lancement
 * de vitest, jamais `apps/backend/data`. Sur un poste de dev, ce dossier-là
 * porte le `database.json` de l'ancien assistant (une base distante), le
 * `setup-complete` et les extensions installées : un test qui le lisait voyait
 * une « source MariaDB configurée » et une installation scellée (audit du
 * chantier SQLite). `vitest.config.ts` pose `TENTACLE_DATA_DIR` sur ce chemin ;
 * `globalSetup` le crée et le supprime. Un test qui veut le sien le pose
 * lui-même (`vi.stubEnv`).
 *
 * Le chemin ne dépend que du PID du processus principal de vitest, où la
 * configuration ET `globalSetup` sont évalués.
 */
export const TEST_DATA_DIR = join(tmpdir(), `tentacle-vitest-data-${process.pid}`);

export default function setup(): () => void {
  rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DATA_DIR, { recursive: true, mode: 0o700 });
  return () => rmSync(TEST_DATA_DIR, { recursive: true, force: true });
}
