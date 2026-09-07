/**
 * La connexion unique à la base locale du hors ligne, sous la racine
 * `Documents/offline/`. Ouverture PARESSEUSE : un utilisateur qui ne garde
 * rien hors ligne ne paie rien. Les migrations sont celles du cœur (`open`).
 */

import { openDatabaseSync } from "expo-sqlite";
import { open, type DatabaseHandle } from "@tentacle-tv/offline-core";
import { wrapExpoDatabase } from "./expoDatabase";
import { offlineVolume } from "./volume";

export const DB_FILE_NAME = "tentacle-offline.db";

let handle: DatabaseHandle | null = null;

/** La connexion, ouverte au premier appel. */
export function localDb(): DatabaseHandle {
  if (handle === null) {
    // expo-sqlite accepte une URI `file://` comme dossier (résolue en chemin natif).
    handle = open(wrapExpoDatabase(openDatabaseSync(DB_FILE_NAME, undefined, offlineVolume().root)));
  }
  return handle;
}

/** Ferme la base — avant de supprimer la racine (« tout retirer »). */
export function closeLocalDb(): void {
  if (handle === null) return;
  handle.close();
  handle = null;
}
