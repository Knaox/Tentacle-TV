/**
 * La racine du hors ligne sur le mobile : `Documents/offline/` — `media/`,
 * `meta/` et la base locale y vivent tous. Une seule règle d'exclusion de
 * sauvegarde, et « tout retirer » = un seul dossier à supprimer.
 *
 * Pas de racine configurable ici (bac à sable de l'application), et surtout
 * JAMAIS `settings.storage_root` : le conteneur iOS change de chemin à chaque
 * mise à jour, la racine se recalcule depuis `Paths.document` à chaque
 * lancement. Les chemins en base restent relatifs, donc valides.
 */

import { Directory, Paths } from "expo-file-system";
import { ensureLayout, type Volume } from "@tentacle-tv/offline-core";
import { setExcludedFromBackup } from "../../modules/offline-storage";
import { expoFileStore, stripTrailingSlashes } from "./expoFileStore";

export const OFFLINE_DIR_NAME = "offline";

let cached: Volume | null = null;

/** `Documents/offline`, en URI `file://`, sans barre finale. */
export function offlineRootUri(): string {
  return stripTrailingSlashes(new Directory(Paths.document, OFFLINE_DIR_NAME).uri);
}

/** Le volume du hors ligne, créé (et exclu de la sauvegarde) au premier appel. */
export function offlineVolume(): Volume {
  if (cached !== null) return cached;
  const volume: Volume = { files: expoFileStore, root: offlineRootUri() };
  expoFileStore.mkdirp(volume.root);
  ensureLayout(volume);
  setExcludedFromBackup(volume.root, true);
  cached = volume;
  return volume;
}

/** Après « tout retirer » : la racine sera recréée au prochain appel. */
export function forgetOfflineVolume(): void {
  cached = null;
}
