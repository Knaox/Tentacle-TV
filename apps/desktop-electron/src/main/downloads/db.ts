/**
 * Ouverture et migration de la base locale.
 *
 * # Le même fichier que l'app Tauri
 *
 * `tentacle-local.db` vit dans le dossier de données de l'application, celui
 * que `useExistingUserData()` fait pointer sur l'identifiant hérité. Ce n'est
 * donc PAS une base neuve : c'est celle que l'utilisateur a déjà, avec ses
 * téléchargements et sa session. Les migrations sont pilotées par
 * `PRAGMA user_version` — sur une base existante, déjà en v7, rien ne
 * s'exécute.
 *
 * # Pourquoi une seule connexion, là où le Rust en ouvrait une par commande
 *
 * `commands.rs` ouvrait court parce que ses transferts tournaient sur de vrais
 * threads, chacun avec sa connexion. Ici tout vit sur la boucle d'évènements du
 * processus principal : une connexion unique est plus simple et plus rapide,
 * et aucune concurrence ne s'y présente. WAL et `busy_timeout` restent posés —
 * le fichier peut être partagé avec l'app Tauri sur une machine de
 * développement.
 *
 * Ce fichier n'importe JAMAIS `electron` : c'est ce qui permet de le tester
 * sous vitest sur une base en mémoire. Le chemin lui est donné, il ne le
 * cherche pas.
 */

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { MIGRATIONS } from "./schema";
import { integer, textOrNull } from "./rows";

export const DB_FILE_NAME = "tentacle-local.db";

/** `<dossier de données>/tentacle-local.db`, dossier créé au besoin. */
export function dbPath(userDataDir: string): string {
  mkdirSync(userDataDir, { recursive: true });
  return path.join(userDataDir, DB_FILE_NAME);
}

/** Ouvre la base, pose les PRAGMA de rigueur et applique les migrations. */
export function open(file: string): DatabaseSync {
  const db = new DatabaseSync(file);
  configure(db);
  migrate(db);
  return db;
}

/** Base en mémoire, même schéma que la vraie. Réservée aux tests. */
export function openInMemory(): DatabaseSync {
  return open(":memory:");
}

function configure(db: DatabaseSync): void {
  // WAL : lectures et écriture concurrentes sans blocage mutuel. Sans effet sur
  // `:memory:`, qui rend « memory » — ce n'est pas une erreur.
  db.exec("PRAGMA journal_mode = WAL");
  // Le `ON DELETE CASCADE` de `claims` en dépend : sans ce PRAGMA, supprimer
  // une ligne de `files` laisserait ses claims orphelins.
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
}

function migrate(db: DatabaseSync): void {
  const version = userVersion(db);
  // L'INDEX vaut la version : le palier 0 amène à `user_version = 1`. Une base
  // en v7 démarre donc la boucle au-delà du dernier palier et ne fait rien.
  for (let index = version; index < MIGRATIONS.length; index += 1) {
    const sql = MIGRATIONS[index];
    if (sql === undefined) break;
    apply(db, sql, index + 1);
  }
}

function apply(db: DatabaseSync, sql: string, target: number): void {
  // Chaque palier est atomique : une migration à moitié appliquée laisserait
  // une base dont la version ment sur le contenu.
  db.exec(`BEGIN;\n${sql}\nCOMMIT;`);
  // `PRAGMA` n'accepte pas de paramètre lié. `target` est un entier produit par
  // la boucle ci-dessus, jamais une donnée venue de l'extérieur.
  db.exec(`PRAGMA user_version = ${target}`);
}

/** Version de schéma de la base ouverte. */
export function userVersion(db: DatabaseSync): number {
  const row = db.prepare("PRAGMA user_version").get();
  return row === undefined ? 0 : integer(row, "user_version");
}

/** Lecture d'un paramètre local (racine de stockage, préférences). */
export function settingGet(db: DatabaseSync, key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row === undefined ? null : textOrNull(row, "value");
}

export function settingSet(db: DatabaseSync, key: string, value: string): void {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value);
}
