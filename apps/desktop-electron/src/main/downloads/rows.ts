/**
 * Lecture TYPÉE des lignes rendues par `node:sqlite`.
 *
 * # Pourquoi ce fichier existe
 *
 * `StatementSync.get()` rend un `Record<string, SQLOutputValue>` : chaque
 * colonne peut valoir `null | number | bigint | string | Uint8Array`, et le
 * compilateur ne sait rien du schéma. Sans ce passage obligé, chaque lecture
 * demanderait un transtypage, et la règle « aucun `any` » tomberait au premier
 * `SELECT`.
 *
 * Une valeur d'un type inattendu n'est pas une donnée à rattraper : c'est une
 * INCOHÉRENCE entre le code et le schéma, donc un défaut. On lève, avec le nom
 * de la colonne — sans lui, le message ne désigne rien.
 *
 * # Le piège que ces fonctions évitent
 *
 * `SQLInputValue` n'admet ni `undefined` ni `boolean` : les deux lèvent à
 * l'exécution (« Provided value cannot be bound to SQLite parameter »). Tout
 * `Option<T>` du Rust devient donc `T | null`, jamais `T | undefined`, et tout
 * booléen passe par `bit()`. TypeScript refuse les deux avant l'exécution :
 * c'est ce qui fait du typecheck une vraie porte sur cette couche.
 */

import type { SQLOutputValue } from "node:sqlite";

/** Une ligne, telle que `node:sqlite` la rend. */
export type Row = Record<string, SQLOutputValue>;

function pick(row: Row, column: string): SQLOutputValue {
  const value = row[column];
  // `undefined` = colonne ABSENTE de la requête ; `null` = colonne présente et
  // nulle. Les confondre ferait chercher un défaut de données là où c'est le
  // `SELECT` qui est faux.
  if (value === undefined) throw new Error(`colonne absente du resultat : ${column}`);
  return value;
}

function refuse(column: string, attendu: string, recu: SQLOutputValue): never {
  throw new Error(`colonne ${column} : ${attendu} attendu, recu ${typeof recu}`);
}

/** Texte non nul. */
export function text(row: Row, column: string): string {
  const value = pick(row, column);
  return typeof value === "string" ? value : refuse(column, "texte", value);
}

/** Texte, ou `null` si la colonne est nulle. */
export function textOrNull(row: Row, column: string): string | null {
  const value = pick(row, column);
  if (value === null) return null;
  return typeof value === "string" ? value : refuse(column, "texte", value);
}

/**
 * Entier non nul.
 *
 * `bigint` accepté en entrée : SQLite le rend pour les valeurs qui ne tiennent
 * pas dans un double. Les nôtres tiennent toutes — un tick Jellyfin vaut
 * 36 000 000 000 pour une heure —, mais on ne suppose pas : hors plage sûre, on
 * lève plutôt que d'arrondir en silence.
 */
export function integer(row: Row, column: string): number {
  const value = pick(row, column);
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return fromBigInt(column, value);
  return refuse(column, "entier", value);
}

/** Entier, ou `null` si la colonne est nulle. */
export function integerOrNull(row: Row, column: string): number | null {
  const value = pick(row, column);
  if (value === null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return fromBigInt(column, value);
  return refuse(column, "entier", value);
}

/** Booléen stocké en 0 / 1, comme le fait le Rust (`bool as i64`). */
export function flag(row: Row, column: string): boolean {
  return integer(row, column) !== 0;
}

/**
 * Booléen prêt à être LIÉ. `run(..., true)` lève ; `run(..., bit(true))` non.
 */
export function bit(value: boolean): number {
  return value ? 1 : 0;
}

/** Normalise un `lastInsertRowid`, que Node rend en `number` ou en `bigint`. */
export function rowId(value: number | bigint): number {
  return typeof value === "bigint" ? fromBigInt("lastInsertRowid", value) : value;
}

function fromBigInt(label: string, value: bigint): number {
  const asNumber = Number(value);
  if (!Number.isSafeInteger(asNumber)) {
    throw new Error(`${label} : entier hors de la plage sure (${value})`);
  }
  return asNumber;
}
