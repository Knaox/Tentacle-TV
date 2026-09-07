/**
 * L'adaptateur base de données du mobile : expo-sqlite derrière le
 * `DatabaseHandle` du cœur hors ligne.
 *
 * Le cœur écrit `db.prepare(sql).get(...)`, `all`, `run` et `exec` ; expo-sqlite
 * offre `getFirstSync`, `getAllSync`, `runSync` et `execSync`. La
 * correspondance tient en quelques lignes — et c'est tout ce que ce fichier
 * fait. `execSync` accepte plusieurs instructions : les paliers de schéma
 * (`BEGIN; … COMMIT;`) en dépendent.
 */

import type { SQLiteBindValue, SQLiteDatabase } from "expo-sqlite";
import type { DatabaseHandle, Row, SqlParam, Statement } from "@tentacle-tv/offline-core";

function bind(params: SqlParam[]): SQLiteBindValue[] {
  return params;
}

function prepare(db: SQLiteDatabase, sql: string): Statement {
  return {
    get: (...params) => db.getFirstSync<Row>(sql, bind(params)) ?? undefined,
    all: (...params) => db.getAllSync<Row>(sql, bind(params)),
    run: (...params) => {
      const result = db.runSync(sql, bind(params));
      return { changes: result.changes, lastInsertRowid: result.lastInsertRowId };
    },
  };
}

/** Une connexion expo-sqlite ouverte, vue par le cœur. */
export function wrapExpoDatabase(db: SQLiteDatabase): DatabaseHandle {
  return {
    prepare: (sql) => prepare(db, sql),
    exec: (sql) => db.execSync(sql),
    close: () => db.closeSync(),
  };
}
