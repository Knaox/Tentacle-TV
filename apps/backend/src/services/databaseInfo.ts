/**
 * Ce que la page admin « Services » dit de la base : où elle est, et QUI
 * décide de la connexion au prochain démarrage.
 *
 * Fonctions pures, à part de `db.ts` : elles se testent sans Prisma.
 */

export interface DatabaseFields {
  host: string;
  port: number;
  database: string;
  user: string;
}

/** Les champs d'une URL `mysql://` — jamais le mot de passe. */
export function parseDatabaseUrl(url: string): DatabaseFields | null {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port) || 3306,
      database: u.pathname.replace(/^\//, ""),
      user: decodeURIComponent(u.username),
    };
  } catch {
    return null;
  }
}

/**
 * D'où vient la connexion, au sens qui compte pour l'administrateur : qui
 * l'emporte au prochain démarrage.
 *
 * `process.env.DATABASE_URL` ne suffit pas à le dire. L'entrée de l'image
 * Docker y exporte elle-même le contenu de `data/database.json` quand
 * l'environnement ne fournit rien, et `saveDatabaseUrl` la réécrit à chaud :
 * la variable est donc presque toujours posée, qu'elle vienne du
 * docker-compose ou du fichier. Seule la comparaison des deux, TELS QU'AU
 * DÉMARRAGE, tranche :
 *
 * - `env` : l'environnement fournissait une URL que le fichier n'a pas — le
 *   docker-compose livré, un service système. Une modification depuis l'admin
 *   écrirait le fichier, que l'environnement recouvrirait au redémarrage ;
 * - `file` : l'URL vient de `data/database.json` (lue directement, ou recopiée
 *   par l'entrée Docker) — l'admin peut la changer ;
 * - `null` : aucune base configurée.
 */
export type DatabaseUrlSource = "env" | "file";

export function resolveDatabaseUrlSource(
  bootEnvUrl: string | null,
  bootFileUrl: string | null,
  currentUrl: string | null,
): DatabaseUrlSource | null {
  if (bootEnvUrl && bootEnvUrl !== bootFileUrl) return "env";
  return currentUrl ? "file" : null;
}
