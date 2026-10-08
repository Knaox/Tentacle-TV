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
 * Les preuves : le secret `db_password` d'une pile officielle d'avant, si son
 * volume est encore monté, ou l'un des MARQUEURS qu'un serveur d'avant laisse
 * dans son dossier de données (`LEGACY_DATA_MARKERS`).
 */
export const SECRETS_DIR = process.env.TENTACLE_SECRETS_DIR || "/run/tentacle-secrets";

/**
 * Ce qu'un serveur d'AVANT 1.25 laisse dans son dossier de données, et qu'une
 * 1.25 neuve ne crée qu'APRÈS `tentacle.db` (la base s'ouvre avant tout le reste,
 * et aucun module n'écrit à l'import) :
 * - `setup-complete` — l'installation scellée (1.24.0 la pose dès son démarrage) ;
 * - `compat/`, `update/` — les versions de Jellyfin et du serveur, relues au
 *   premier tableau de bord ;
 * - `plugins/` — une extension installée ou une source ajoutée ;
 * - `tools/` — yt-dlp, à la première bande-annonce relayée.
 * Aucun n'est garanti seul ; ensemble, ils couvrent l'installation ≤ 1.23 qui a
 * servi, qu'aucun `setup-complete` ne trahirait. N'en sont PAS : `shared-deps/`
 * (l'entrypoint le recrée à CHAQUE démarrage, avant le serveur), ni ce que la CLI
 * peut poser avant le premier démarrage (`web-ui`, `setup-token.txt`).
 */
export const LEGACY_DATA_MARKERS = ["setup-complete", "compat", "update", "plugins", "tools"] as const;

/**
 * La porte de sortie, choisie à la machine (`tentacle db start-fresh --confirm`) :
 * l'ancienne base est perdue pour de bon, ou volontairement abandonnée — on
 * repart d'une installation neuve. Jamais par HTTP.
 */
export const FRESH_START_FILE = "db-fresh-start";

export function orphanedLegacyInstallation(
  legacyUrl: string | null = legacyMariadbUrl(),
  dataRoot: string = DATA_ROOT,
  secretsDir: string = SECRETS_DIR,
): boolean {
  if (legacyUrl) return false;
  if (existsSync(coreDatabasePath(dataRoot))) return false;
  if (existsSync(join(dataRoot, FRESH_START_FILE))) return false;
  if (existsSync(join(secretsDir, "db_password"))) return true;
  return LEGACY_DATA_MARKERS.some((name) => existsSync(join(dataRoot, name)));
}

/**
 * Tenir l'installation orpheline : l'écran d'attente en échec, sans nouvel essai
 * automatique (rien ne change sans un redémarrage de la pile corrigée). Ne rend
 * jamais la main : le démarrage normal ne doit pas avoir lieu.
 */
export async function holdOrphanedInstallation(startMaintenance: () => Promise<unknown>, log: (line: string) => void = console.log): Promise<never> {
  log(
    "[db-migration] ⚠️ Cette installation utilisait une base MariaDB, qui n'est plus configurée (ni DATABASE_URL, ni DB_HOST, ni le fichier de l'ancien assistant). " +
      "Ses données y sont toujours : remettez le service de la base et ses variables le temps de la migration, puis redémarrez. Aucune base vide n'est créée.",
  );
  migrationFailed("source_missing", null);
  await startMaintenance();
  return new Promise<never>(() => undefined);
}
