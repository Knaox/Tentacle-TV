/**
 * Le module natif local du hors ligne : l'exclusion de la sauvegarde, et le
 * service de premier plan Android des transferts.
 *
 * Apple exige (règle 2.23) que les données re-téléchargeables gardées hors
 * ligne portent l'attribut « ne pas sauvegarder » (`isExcludedFromBackup`) —
 * Expo n'expose aucune API pour le poser, d'où ces quelques lignes de Swift.
 * Sur Android, l'exclusion passe par les règles de sauvegarde XML
 * (`res/xml/offline_*_rules.xml`) : le module y rend `false`, sans effet.
 *
 * Sur Android, un transfert ne survit ni à l'écran éteint ni à l'application
 * passée derrière sans service de premier plan (`OfflineTransferService`) :
 * le JavaScript le démarre quand le moteur s'occupe et l'arrête quand il se
 * libère. iOS rend `false` : sa session d'arrière-plan suffit.
 *
 * Chargé en optionnel : sans le module (Expo Go, ancien build), tout marche,
 * seule l'exclusion manque — et la CI construit toujours avec.
 */

import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

interface OfflineStorageNative {
  setExcludedFromBackup(uri: string, excluded: boolean): boolean;
  startTransferService?(channelName: string, title: string, body: string): Promise<boolean>;
  updateTransferService?(body: string): boolean;
  stopTransferService?(): Promise<boolean>;
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

/** Le module quand il porte le service (Android, build récent), sinon `null`. */
function transferServiceModule(): OfflineStorageNative | null {
  if (Platform.OS !== "android" || native === null || typeof native.startTransferService !== "function") return null;
  return native;
}

/** Démarre le service de premier plan ; `false` si Android refuse (arrière-plan, quota) ou sans module. */
export async function startTransferService(channelName: string, title: string, body: string): Promise<boolean> {
  const module = transferServiceModule();
  if (module === null || module.startTransferService === undefined) return false;
  try {
    return await module.startTransferService(channelName, title, body);
  } catch {
    return false;
  }
}

/** Met à jour le corps de la notification du service ; `false` sans service en cours. */
export function updateTransferService(body: string): boolean {
  const module = transferServiceModule();
  if (module === null || module.updateTransferService === undefined) return false;
  try {
    return module.updateTransferService(body);
  } catch {
    return false;
  }
}

export async function stopTransferService(): Promise<boolean> {
  const module = transferServiceModule();
  if (module === null || module.stopTransferService === undefined) return false;
  try {
    return await module.stopTransferService();
  } catch {
    return false;
  }
}
