/**
 * La connexion à l'ancienne base MariaDB d'une installation qui passe à SQLite.
 *
 * OÙ elle est se décide dans le socle (`services/database/legacySource.ts` →
 * `legacyMariadbUrl()` : `DATABASE_URL`, variables `DB_*` des piles, fichier de
 * l'ancien assistant) ; ce module n'en tire que les paramètres du pilote et ce
 * que le journal peut en dire.
 *
 * Tout ce dossier (`legacySource/`) ne sert qu'à LIRE une source : il partira
 * avec le support de MariaDB, dans deux ou trois versions.
 */

/** Une URL MariaDB/MySQL — une URL `file:` (SQLite) n'est pas une source. */
export function isMariadbUrl(url: string | undefined | null): url is string {
  return !!url && /^(mysql|mariadb):\/\//i.test(url.trim());
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
