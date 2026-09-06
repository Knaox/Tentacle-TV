/**
 * Le module natif local du hors ligne : l'exclusion de la sauvegarde.
 *
 * Apple exige (règle 2.23) que les données re-téléchargeables gardées hors
 * ligne portent l'attribut « ne pas sauvegarder » (`isExcludedFromBackup`) —
 * Expo n'expose aucune API pour le poser, d'où ces quelques lignes de Swift.
 * Sur Android, l'exclusion passe par les règles de sauvegarde XML
 * (`res/xml/offline_*_rules.xml`) : le module y rend `false`, sans effet.
 *
 * Chargé en optionnel : sans le module (Expo Go, ancien build), tout marche,
 * seule l'exclusion manque — et la CI construit toujours avec.
 */

import { requireOptionalNativeModule } from "expo";

interface OfflineStorageNative {
  setExcludedFromBackup(uri: string, excluded: boolean): boolean;
}

const native = requireOptionalNativeModule<OfflineStorageNative>("OfflineStorage");

/** Pose (ou retire) l'attribut sur un fichier ou un dossier ; `false` si rien n'a été fait. */
export function setExcludedFromBackup(uri: string, excluded = true): boolean {
  if (native === null) return false;
  try {
    return native.setExcludedFromBackup(uri, excluded);
  } catch {
    return false;
  }
}
