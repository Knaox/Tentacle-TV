import { existsSync } from "fs";
import { openSqlite } from "../services/database/nodeSqlite";
import { coreDatabasePath } from "../services/database/sqlitePath";

/**
 * `tentacle db query "<SELECT …>"` — lire la base depuis la console du
 * conteneur : l'image n'a pas de client `sqlite3`. LECTURE SEULE, deux fois :
 * le fichier est ouvert en lecture seule et `query_only` est posé ; une
 * écriture est refusée par SQLite elle-même. Un autre processus que le
 * serveur : en WAL, il lit sans le gêner (docs/sqlite/DECISION.md § 8).
 *
 *   tentacle db query "SELECT key FROM server_config ORDER BY key"
 *   tentacle db query --json "SELECT COUNT(*) AS n FROM paired_devices"
 *   tentacle db query --no-header "SELECT value FROM server_config WHERE key = 'jellyfin_url'"
 */
export const DB_USAGE = [
  '  tentacle db query "<SQL>"  lit la base (lecture seule) ; --json, --no-header',
  "                         read the database (read-only); --json, --no-header",
];

type Row = Record<string, unknown>;

function cell(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Uint8Array) return `<${value.byteLength} octets>`;
  return String(value).replace(/\t/g, " ").replace(/\r?\n/g, "\\n");
}

/** Lignes en texte : tabulations entre les colonnes, comme `mariadb -e`. */
export function formatRows(rows: Row[], header: boolean): string[] {
  if (rows.length === 0) return [];
  const columns = Object.keys(rows[0]);
  const lines = rows.map((row) => columns.map((column) => cell(row[column])).join("\t"));
  return header ? [columns.join("\t"), ...lines] : lines;
}

export function runDbCommand(action: string | undefined, rawArgs: string[], path: string = coreDatabasePath()): number {
  if (action !== "query") {
    console.error(`Commande inconnue / unknown command : tentacle db ${action ?? ""}`.trim());
    for (const line of DB_USAGE) console.error(line);
    return 2;
  }
  const json = rawArgs.includes("--json");
  const header = !rawArgs.includes("--no-header");
  const sql = rawArgs.filter((arg) => arg !== "--json" && arg !== "--no-header").join(" ").trim();
  if (!sql) {
    for (const line of DB_USAGE) console.error(line);
    return 2;
  }
  if (!existsSync(path)) {
    console.error(`Base introuvable / database not found : ${path}`);
    return 1;
  }
  const db = openSqlite(path, { readOnly: true });
  try {
    db.exec("PRAGMA query_only = ON");
    const rows = db.prepare(sql).all() as Row[];
    if (json) console.log(JSON.stringify(rows, (_key, value: unknown) => (typeof value === "bigint" ? Number(value) : value)));
    else for (const line of formatRows(rows, header)) console.log(line);
    return 0;
  } catch (error) {
    console.error(`Requête refusée / query refused : ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    db.close();
  }
}
