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
 * # Aucune plateforme nommée ici
 *
 * Ce fichier ne connaît ni `node:sqlite`, ni `electron`, ni Expo : il reçoit
 * une connexion déjà ouverte (`DatabaseHandle`, voir `adapters.ts`) et la
 * prépare. C'est `node/nodeDatabase.ts` qui ouvre le fichier sur le bureau,
 * l'adaptateur expo-sqlite sur le mobile. Testable sous vitest sur une base en
 * mémoire.
 */

import type { DatabaseHandle } from "./adapters";
import { MIGRATIONS } from "./schema";
import { integer, textOrNull } from "./rows";

/** Pose les PRAGMA de rigueur et applique les migrations sur une connexion ouverte. */
export function open(db: DatabaseHandle): DatabaseHandle {
  configure(db);
  migrate(db);
  return db;
}

function configure(db: DatabaseHandle): void {
  // WAL : lectures et écriture concurrentes sans blocage mutuel. Sans effet sur
  // `:memory:`, qui rend « memory » — ce n'est pas une erreur.
  db.exec("PRAGMA journal_mode = WAL");
  // Le `ON DELETE CASCADE` de `claims` en dépend : sans ce PRAGMA, supprimer
  // une ligne de `files` laisserait ses claims orphelins.
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
}

function migrate(db: DatabaseHandle): void {
  const version = userVersion(db);
  // L'INDEX vaut la version : le palier 0 amène à `user_version = 1`. Une base
  // en v7 démarre donc la boucle au-delà du dernier palier et ne fait rien.
  for (let index = version; index < MIGRATIONS.length; index += 1) {
    const sql = MIGRATIONS[index];
    if (sql === undefined) break;
    apply(db, sql, index + 1);
  }
}

function apply(db: DatabaseHandle, sql: string, target: number): void {
  // Chaque palier est atomique : une migration à moitié appliquée laisserait
  // une base dont la version ment sur le contenu.
  db.exec(`BEGIN;\n${sql}\nCOMMIT;`);
  // `PRAGMA` n'accepte pas de paramètre lié. `target` est un entier produit par
  // la boucle ci-dessus, jamais une donnée venue de l'extérieur.
  db.exec(`PRAGMA user_version = ${target}`);
}

/**
 * Exécute `body` dans une transaction, et annule tout s'il lève.
 *
 * ⚠️ Ne s'imbrique PAS : SQLite n'a qu'une transaction par connexion, et nous
 * n'en avons qu'une. Aucun appelant n'en imbrique aujourd'hui — la purge, qui
 * boucle sur des suppressions, en ouvre une par tour.
 */
export function transaction<T>(db: DatabaseHandle, body: () => T): T {
  db.exec("BEGIN");
  try {
    const result = body();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/** Version de schéma de la base ouverte. */
export function userVersion(db: DatabaseHandle): number {
  const row = db.prepare("PRAGMA user_version").get();
  return row === undefined ? 0 : integer(row, "user_version");
}

/** Lecture d'un paramètre local (racine de stockage, préférences). */
export function settingGet(db: DatabaseHandle, key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row === undefined ? null : textOrNull(row, "value");
}

export function settingSet(db: DatabaseHandle, key: string, value: string): void {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value);
}
