import * as mariadb from "mariadb";
import { connectionOptions } from "./sourceConfig";
import { readSourceSchema, type SourceTable } from "./sourceSchema";
import { sourceZoneForConversion } from "./timeZones";

/**
 * Le LECTEUR de l'ancienne base. Une seule connexion, en lecture seule, sur un
 * instantané cohérent : toutes les tables sont lues au même instant, et toute
 * écriture serait refusée par MariaDB elle-même (« MariaDB n'est JAMAIS
 * modifiée », même par erreur, même en cas d'échec).
 *
 * Les tables se lisent par PAGES sur leur clé primaire (curseur `> dernière
 * clé`), jamais un `SELECT *` d'une table entière en mémoire : `tmdb_meta_cache`
 * pèse à lui seul plus de 700 Mo sur une vraie installation.
 */
export type SourceRow = unknown[];

/** Une colonne à lire : son nom, et le fuseau d'où la convertir en UTC (colonne « session »). */
export interface SelectColumn {
  name: string;
  fromZone?: string | null;
}

export interface PageCursor {
  /** Valeurs de la clé de la dernière ligne lue, dans l'ordre de `keyColumns`. */
  after: unknown[] | null;
}

export class MariadbReader {
  private constructor(
    private readonly conn: mariadb.Connection,
    readonly serverVersion: string,
    /** Fuseau des `NOW()` de la source pour `CONVERT_TZ`, `null` si UTC (GENERIC-COPY.md). */
    readonly sourceZone: string | null,
  ) {}

  /** Ouvre la connexion et fige l'instantané. Lève si la base est injoignable. */
  static async open(url: string): Promise<MariadbReader> {
    const conn = await mariadb.createConnection({
      // Délais de connexion ET de lecture bornés ; TLS exigé s'il était demandé.
      ...connectionOptions(url),
      // Les dates restent du TEXTE tel que MariaDB l'a rangé : aucune conversion
      // de fuseau par le pilote (Prisma écrit l'UTC dans des DATETIME nus).
      dateStrings: true,
      // Aucun nombre ne se perd : BIGINT et DECIMAL arrivent exacts, convertis ensuite.
      bigIntAsNumber: false,
      decimalAsNumber: false,
      // Le JSON (`seasons` de Vigie) reste le TEXTE rangé, octet pour octet.
      autoJsonMap: false,
      rowsAsArray: true,
      multipleStatements: false,
      // Une erreur du pilote ne recopie jamais au journal les valeurs d'une page (clés).
      logParam: false,
    });
    try {
      // Le fuseau des `NOW()` d'avant, PUIS la lecture en UTC : un TIMESTAMP (rangé
      // en UTC par MariaDB) ressort alors exact, un DATETIME tel qu'il fut écrit.
      const [[sessionZone, systemZone, offsetMinutes]] = (await conn.query({
        sql: "SELECT @@session.time_zone, @@system_time_zone, TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), NOW())",
        rowsAsArray: true,
      })) as [[string, string, number | bigint]];
      const zone = await usableZone(conn, sourceZoneForConversion(String(sessionZone), String(systemZone ?? "")), Number(offsetMinutes));
      await conn.query("SET time_zone = '+00:00'");
      await conn.query("SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      await conn.query("SET SESSION TRANSACTION READ ONLY");
      await conn.query("START TRANSACTION WITH CONSISTENT SNAPSHOT");
      const [[version]] = (await conn.query({ sql: "SELECT VERSION()", rowsAsArray: true })) as [[string]];
      return new MariadbReader(conn, version, zone);
    } catch (err) {
      await conn.end().catch(() => conn.destroy());
      throw err;
    }
  }

  /** Les tables de la base, leurs colonnes, clés et index (`information_schema`). */
  tables(): Promise<SourceTable[]> {
    return readSourceSchema((sql, params) => this.rows(sql, params));
  }

  /** Une clé de `server_config` de la source, ou `null` (table absente comprise). */
  async configValue(key: string): Promise<string | null> {
    const table = await this.rows(
      "SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_config'",
    );
    if (table.length === 0) return null;
    const rows = await this.rows("SELECT `value` FROM `server_config` WHERE `key` = ?", [key]);
    return rows.length ? String(rows[0][0]) : null;
  }

  /** Lignes déjà parcourues jusqu'au curseur (clé ≤ curseur) : la reprise d'une copie de fond. */
  async countBefore(table: SourceTable, after: unknown[]): Promise<number> {
    if (table.keyColumns.length === 0) return 0;
    const { clause, params } = afterKey(table.keyColumns, after);
    const [[n]] = (await this.rows(`SELECT COUNT(*) FROM ${quoteId(table.name)} WHERE NOT (${clause})`, params)) as [[bigint | number]];
    return Number(n);
  }

  /** Nombre exact de lignes, dans l'instantané. */
  async count(table: string): Promise<number> {
    const [[n]] = (await this.rows(`SELECT COUNT(*) FROM ${quoteId(table)}`)) as [[bigint | number]];
    return Number(n);
  }

  /**
   * Une page de `table` triée sur `keyColumns`, après le curseur. Une table sans
   * clé (une extension maladroite) se lit triée sur TOUTES ses colonnes, par
   * décalage : l'instantané garantit le même ordre d'une page à l'autre.
   */
  async page(table: SourceTable, columns: SelectColumn[], cursor: PageCursor, size: number, offset = 0): Promise<SourceRow[]> {
    // Le fuseau d'une colonne « session » est un paramètre LIÉ, jamais du texte collé.
    const zoneParams: unknown[] = [];
    const select = columns
      .map((c) => {
        if (!c.fromZone) return quoteId(c.name);
        zoneParams.push(c.fromZone);
        return `CONVERT_TZ(${quoteId(c.name)}, ?, '+00:00')`;
      })
      .join(", ");
    const keys = table.keyColumns;
    if (keys.length === 0) {
      const order = table.columns.map((c) => quoteId(c.name)).join(", ");
      return this.rows(`SELECT ${select} FROM ${quoteId(table.name)} ORDER BY ${order} LIMIT ? OFFSET ?`, [...zoneParams, size, offset]);
    }
    const order = keys.map(quoteId).join(", ");
    if (!cursor.after) {
      return this.rows(`SELECT ${select} FROM ${quoteId(table.name)} ORDER BY ${order} LIMIT ?`, [...zoneParams, size]);
    }
    const { clause, params } = afterKey(keys, cursor.after);
    return this.rows(`SELECT ${select} FROM ${quoteId(table.name)} WHERE ${clause} ORDER BY ${order} LIMIT ?`, [
      ...zoneParams,
      ...params,
      size,
    ]);
  }

  /** Requête de lecture brute (lignes en tableaux). Jamais exposée hors de ce module. */
  private async rows(sql: string, params: unknown[] = []): Promise<SourceRow[]> {
    return (await this.conn.query({ sql, rowsAsArray: true }, params)) as SourceRow[];
  }

  async close(): Promise<void> {
    try {
      await this.conn.query("ROLLBACK");
    } finally {
      await this.conn.end().catch(() => this.conn.destroy());
    }
  }
}

/**
 * Un fuseau que `CONVERT_TZ` connaît vraiment : un fuseau NOMMÉ exige les tables
 * de fuseaux (souvent absentes de MySQL) — sans elles, `CONVERT_TZ` rend NULL.
 * Repli : le décalage d'aujourd'hui en chiffres (`+02:00`), sans l'heure d'été
 * d'une date d'une autre saison — dit au journal par l'orchestrateur.
 */
async function usableZone(conn: mariadb.Connection, zone: string | null, offsetMinutes: number): Promise<string | null> {
  if (zone === null) return null;
  const [[probe]] = (await conn.query({ sql: "SELECT CONVERT_TZ('2026-01-15 12:00:00', ?, '+00:00')", rowsAsArray: true }, [zone])) as [[unknown]];
  if (probe !== null && probe !== undefined) return zone;
  if (offsetMinutes === 0) return null;
  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

export function quoteId(name: string): string {
  return `\`${name.replace(/`/g, "``")}\``;
}

/**
 * `(a, b) > (x, y)` écrit en `a > x OR (a = x AND b > y)` : MariaDB n'emploie pas
 * toujours l'index pour un constructeur de ligne, il l'emploie pour cette forme.
 */
export function afterKey(keys: string[], after: unknown[]): { clause: string; params: unknown[] } {
  const ors: string[] = [];
  const params: unknown[] = [];
  keys.forEach((key, i) => {
    const eq = keys.slice(0, i).map((k) => `${quoteId(k)} = ?`);
    ors.push(`(${[...eq, `${quoteId(key)} > ?`].join(" AND ")})`);
    params.push(...after.slice(0, i), after[i]);
  });
  return { clause: ors.join(" OR "), params };
}
