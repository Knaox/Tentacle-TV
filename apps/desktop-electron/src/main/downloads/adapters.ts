/**
 * Les adaptateurs du cœur hors ligne.
 *
 * # Pourquoi
 *
 * Le cœur (file d'attente, transferts, photos de fiches, purge, lecture locale)
 * ne doit connaître ni Node, ni Electron, ni Expo : c'est ce qui le rend
 * PORTABLE entre le bureau et le mobile, et testable sur une base en mémoire.
 * Tout ce qui touche le monde extérieur passe par les interfaces de ce
 * fichier ; chaque plateforme les implémente une fois (`node/` ici, la couche
 * hors ligne de l'app mobile là-bas).
 *
 * # Base de données
 *
 * `DatabaseSync` de `node:sqlite` est STRUCTURELLEMENT un `DatabaseHandle` :
 * `prepare().get/all/run`, `exec`, `close`. L'adaptateur Node est donc un
 * simple typage, et le cœur garde ses `db.prepare(sql).get(...)` tels quels.
 * Côté mobile, expo-sqlite (`getFirstSync`, `getAllSync`, `runSync`,
 * `execSync`) s'y ramène en quelques lignes.
 */

/** Ce que SQLite rend. expo-sqlite ne rend jamais de `bigint` ; node:sqlite parfois. */
export type SqlValue = null | number | bigint | string | Uint8Array;

/**
 * Ce que l'on LIE. Ni `boolean` ni `undefined` : les deux lèvent à l'exécution
 * chez node:sqlite (« Provided value cannot be bound to SQLite parameter »).
 * Tout booléen passe par `bit()`, tout optionnel par `?? null` (voir `rows.ts`).
 */
export type SqlParam = null | number | string | Uint8Array;

/** Une ligne, telle que la base la rend. */
export type Row = Record<string, SqlValue>;

/** Résultat d'une écriture. Node rend `number` ou `bigint` ; `rowId()` normalise. */
export interface RunResult {
  changes: number | bigint;
  lastInsertRowid: number | bigint;
}

/**
 * Une requête préparée. Méthodes déclarées en raccourci (et non en propriétés
 * fonction) pour rester assignables depuis `StatementSync`, dont les
 * paramètres acceptés sont plus larges.
 */
export interface Statement {
  get(...params: SqlParam[]): Row | undefined;
  all(...params: SqlParam[]): Row[];
  run(...params: SqlParam[]): RunResult;
}

/**
 * La connexion. `exec` accepte PLUSIEURS instructions : les paliers de schéma
 * (`BEGIN; … COMMIT;`) en dépendent.
 */
export interface DatabaseHandle {
  prepare(sql: string): Statement;
  exec(sql: string): void;
  close(): void;
}
