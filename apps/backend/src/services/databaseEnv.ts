import { readFileSync } from "fs";

/**
 * L'URL de la base composée des variables `DB_*`, quand `DATABASE_URL` n'est
 * pas donnée.
 *
 * Les piles Docker (`stacks/`) n'écrivent AUCUN secret dans leur compose : le
 * mot de passe naît au premier démarrage (service `init`) dans un volume que
 * seuls la base et le serveur montent, et le serveur le lit par
 * `DB_PASSWORD_FILE`. `DATABASE_URL` garde la priorité : les installations
 * d'avant la posent dans leur compose.
 */
export interface DatabaseEnv {
  DATABASE_URL?: string;
  DB_HOST?: string;
  DB_PORT?: string;
  DB_NAME?: string;
  DB_USER?: string;
  DB_PASSWORD?: string;
  DB_PASSWORD_FILE?: string;
}

const DEFAULTS = { port: "3306", name: "tentacle", user: "tentacle" };

/** Dit une fois : l'URL se relit à chaque requête tant que l'installation n'est pas faite. */
let warnedUnreadable = false;

/** Le mot de passe en clair ou lu dans son fichier (sans le saut de ligne final). */
function readPassword(env: DatabaseEnv, readFile: (path: string) => string): string | null {
  if (env.DB_PASSWORD) return env.DB_PASSWORD;
  if (!env.DB_PASSWORD_FILE) return null;
  try {
    return readFile(env.DB_PASSWORD_FILE).replace(/\r?\n$/, "");
  } catch {
    return null;
  }
}

/**
 * `null` quand rien ne désigne une base par l'environnement — ni URL, ni hôte —
 * ou quand le mot de passe annoncé par fichier est illisible : mieux vaut le
 * mode installation qu'une connexion vouée à l'échec, sans un mot sur la cause.
 */
export function databaseUrlFromEnv(
  env: DatabaseEnv,
  readFile: (path: string) => string = (path) => readFileSync(path, "utf-8"),
): string | null {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  if (!env.DB_HOST) return null;
  const password = readPassword(env, readFile);
  if (password === null) {
    if (!warnedUnreadable) {
      warnedUnreadable = true;
      console.warn(`[DB] DB_HOST posé, mais aucun mot de passe lisible (DB_PASSWORD ou ${env.DB_PASSWORD_FILE ?? "DB_PASSWORD_FILE"})`);
    }
    return null;
  }
  const user = encodeURIComponent(env.DB_USER || DEFAULTS.user);
  const name = encodeURIComponent(env.DB_NAME || DEFAULTS.name);
  return `mysql://${user}:${encodeURIComponent(password)}@${env.DB_HOST}:${env.DB_PORT || DEFAULTS.port}/${name}`;
}
