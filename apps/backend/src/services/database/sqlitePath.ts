import { resolve } from "path";
import { DATA_ROOT } from "../dataDir";

/**
 * Où vit la base, et comment Prisma l'ouvre (docs/sqlite/DECISION.md).
 *
 * Un fichier du dossier de données — le volume `tentacle-data` dans l'image —,
 * jamais une URL à configurer : une installation neuve n'a plus d'étape
 * « base de données ».
 */
export const CORE_DATABASE_FILE = "tentacle.db";

/** Le chemin de la base du cœur : `<dossier de données>/tentacle.db`. */
export function coreDatabasePath(dataRoot: string = DATA_ROOT): string {
  return resolve(dataRoot, CORE_DATABASE_FILE);
}

/**
 * L'URL que reçoit le client Prisma.
 *
 * - `connection_limit=1` : UNE connexion. Mesuré : le pool par défaut prend le
 *   verrou d'écriture par connexion et s'étrangle (107 P1008 sur 464
 *   opérations concurrentes) ; une seule connexion n'en a aucune.
 * - `socket_timeout=15` : le moteur en fait le `busy_timeout` (15 s) de chaque
 *   connexion — l'attente quand un AUTRE processus tient le verrou.
 *
 * Sous Windows, le chemin passe en barres obliques : le moteur lit une URL.
 */
export function prismaSqliteUrl(path: string): string {
  return `file:${path.replace(/\\/g, "/")}?connection_limit=1&socket_timeout=15`;
}
