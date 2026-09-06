/**
 * L'adaptateur base de données pour Node et Electron : `node:sqlite`.
 *
 * Seul fichier de la couche stockage qui NOMME `node:sqlite` en valeur. Le
 * cœur (`db.ts` et les autres) ne voit qu'un `DatabaseHandle` — c'est ce qui
 * le rend portable vers le mobile, où expo-sqlite joue le même rôle.
 *
 * Ce fichier n'importe JAMAIS `electron` : les tests l'utilisent sous vitest
 * sur une base en mémoire. Le chemin lui est donné, il ne le cherche pas.
 */

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { DatabaseHandle } from "../adapters";
import { open } from "../db";

export const DB_FILE_NAME = "tentacle-local.db";

/** `<dossier de données>/tentacle-local.db`, dossier créé au besoin. */
export function dbPath(userDataDir: string): string {
  mkdirSync(userDataDir, { recursive: true });
  return path.join(userDataDir, DB_FILE_NAME);
}

/** Ouvre le fichier, pose les PRAGMA et applique les migrations (voir `db.ts`). */
export function openNodeDatabase(file: string): DatabaseHandle {
  // `DatabaseSync` est structurellement un `DatabaseHandle` : aucun emballage.
  return open(new DatabaseSync(file));
}

/** Base en mémoire, même schéma que la vraie. Réservée aux tests. */
export function openInMemory(): DatabaseHandle {
  return openNodeDatabase(":memory:");
}
