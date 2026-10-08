import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

/**
 * OÙ est l'ancienne base MariaDB d'une installation qui passe à SQLite.
 *
 * Mêmes entrées qu'avant la 1.25 (`databaseEnv.ts` et `data/database.json`) : la
 * migration doit retrouver la base que l'image précédente utilisait, sans que
 * l'administrateur ne touche à son compose. `DATABASE_URL` d'abord, puis les
 * variables `DB_*` des piles (mot de passe en clair ou par `DB_PASSWORD_FILE`),
 * puis le fichier écrit par l'ancien assistant.
 *
 * Tout ce dossier (`legacySource/`) ne sert qu'à LIRE une source : il partira
 * avec le support de MariaDB, dans deux ou trois versions.
 */
export interface LegacySourceEnv {
  DATABASE_URL?: string;
  DB_HOST?: string;
  DB_PORT?: string;
  DB_NAME?: string;
  DB_USER?: string;
  DB_PASSWORD?: string;
  DB_PASSWORD_FILE?: string;
}

/** Où la configuration a été trouvée : le rapport et l'admin le disent. */
export type LegacySourceOrigin = "env-url" | "env-vars" | "database-json";

export interface LegacySource {
  url: string;
  origin: LegacySourceOrigin;
}

/** Une URL MariaDB/MySQL — une URL `file:` (SQLite) n'est pas une source. */
export function isMariadbUrl(url: string | undefined | null): url is string {
  return !!url && /^(mysql|mariadb):\/\//i.test(url.trim());
}

function readPassword(env: LegacySourceEnv, readFile: (path: string) => string): string | null {
  if (env.DB_PASSWORD) return env.DB_PASSWORD;
  if (!env.DB_PASSWORD_FILE) return null;
  try {
    return readFile(env.DB_PASSWORD_FILE).replace(/\r?\n$/, "");
  } catch {
    return null;
  }
}

function fromEnv(env: LegacySourceEnv, readFile: (path: string) => string): LegacySource | null {
  if (isMariadbUrl(env.DATABASE_URL)) return { url: env.DATABASE_URL.trim(), origin: "env-url" };
  if (!env.DB_HOST) return null;
  const password = readPassword(env, readFile);
  if (password === null) return null;
  const user = encodeURIComponent(env.DB_USER || "tentacle");
  const name = encodeURIComponent(env.DB_NAME || "tentacle");
  const url = `mysql://${user}:${encodeURIComponent(password)}@${env.DB_HOST}:${env.DB_PORT || "3306"}/${name}`;
  return { url, origin: "env-vars" };
}

function fromFile(dataDir: string, readFile: (path: string) => string): LegacySource | null {
  const file = resolve(dataDir, "database.json");
  if (!existsSync(file)) return null;
  try {
    const url = JSON.parse(readFile(file))?.url;
    return isMariadbUrl(url) ? { url, origin: "database-json" } : null;
  } catch {
    return null;
  }
}

/** La source MariaDB configurée, ou `null` : une installation neuve n'en a pas. */
export function resolveLegacySource(
  env: LegacySourceEnv,
  dataDir: string,
  readFile: (path: string) => string = (path) => readFileSync(path, "utf-8"),
): LegacySource | null {
  return fromEnv(env, readFile) ?? fromFile(dataDir, readFile);
}

/** Paramètres de connexion du pilote, sans jamais journaliser le mot de passe. */
export function connectionOptions(url: string) {
  const u = new URL(url.trim().replace(/^mariadb:/i, "mysql:"));
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.replace(/^\//, "")),
  };
}

/** L'URL dite au journal : hôte, port, base — jamais l'utilisateur ni le mot de passe. */
export function describeSource(url: string): string {
  const { host, port, database } = connectionOptions(url);
  return `${host}:${port}/${database}`;
}
