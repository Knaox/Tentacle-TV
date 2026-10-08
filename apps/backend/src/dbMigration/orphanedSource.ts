import { existsSync } from "fs";
import { join } from "path";
import { DATA_ROOT } from "../services/dataDir";
import { coreDatabasePath } from "../services/database/sqlitePath";
import { legacyMariadbUrl } from "../services/database/legacySource";
import { migrationFailed } from "./migrationState";

/**
 * Une installation qui AVAIT une base MariaDB démarre SANS source configurée et
 * sans `tentacle.db` : le cas d'une pile mise à jour par son nouveau compose
 * AVANT la migration (Portainer qui suit le dépôt, compose recopié trop tôt) —
 * plus de service `db`, plus de `DB_HOST`. Ses données sont toujours dans le
 * volume de MariaDB. Le serveur ne crée JAMAIS une base vide à la place (elle
 * passerait pour la sienne, assistant fermé, et plus rien ne migrerait) : il
 * reste sur l'écran d'attente, motif `source_missing`, jusqu'à ce que la pile
 * rende sa base le temps de la migration.
 *
 * Les preuves : le secret `db_password` d'une pile officielle d'avant (le volume
 * des secrets reste monté dans les nouvelles piles, le temps de la transition)
 * ou une installation scellée (`data/setup-complete`, depuis 1.24.0).
 */
export const SECRETS_DIR = process.env.TENTACLE_SECRETS_DIR || "/run/tentacle-secrets";

export function orphanedLegacyInstallation(
  legacyUrl: string | null = legacyMariadbUrl(),
  dataRoot: string = DATA_ROOT,
  secretsDir: string = SECRETS_DIR,
): boolean {
  if (legacyUrl) return false;
  if (existsSync(coreDatabasePath(dataRoot))) return false;
  return existsSync(join(secretsDir, "db_password")) || existsSync(join(dataRoot, "setup-complete"));
}

/**
 * Tenir l'installation orpheline : l'écran d'attente en échec, sans nouvel essai
 * automatique (rien ne change sans un redémarrage de la pile corrigée). Ne rend
 * jamais la main : le démarrage normal ne doit pas avoir lieu.
 */
export async function holdOrphanedInstallation(startMaintenance: () => Promise<unknown>, log: (line: string) => void = console.log): Promise<never> {
  log(
    "[db-migration] ⚠️ Cette installation utilisait une base MariaDB, qui n'est plus configurée (ni DATABASE_URL, ni DB_HOST, ni data/database.json). " +
      "Ses données y sont toujours : remettez le service de la base et ses variables le temps de la migration, puis redémarrez. Aucune base vide n'est créée.",
  );
  migrationFailed("source_missing", null);
  await startMaintenance();
  return new Promise<never>(() => undefined);
}
