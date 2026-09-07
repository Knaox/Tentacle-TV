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
 * Il finalise aussi les fichiers Allégé : le transcodage progressif de
 * Jellyfin est un MP4 fragmenté sans index ni durée, que les lecteurs natifs
 * ne savent pas parcourir — remux sur place à la fin du transfert.
 *
 * Sur Android, un transfert ne survit ni à l'écran éteint ni à l'application
 * passée derrière sans service de premier plan (`OfflineTransferService`) :
 * le JavaScript le démarre quand le moteur s'occupe et l'arrête quand il se
 * libère. Sa notification porte la progression et un bouton « Pause », relayé
 * ici par `onTransferPause`. iOS rend `false` : sa session d'arrière-plan
 * suffit, et le système n'y autorise pas de notification permanente.
 *
 * Chargé en optionnel : sans le module (Expo Go, ancien build), tout marche,
 * seule l'exclusion manque — et la CI construit toujours avec.
 */

import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

interface OfflineStorageNative {
  setExcludedFromBackup(uri: string, excluded: boolean): boolean;
  startTransferService?(channelName: string, title: string, body: string, pauseLabel: string): Promise<boolean>;
  /** `progress` en pour-cent ; négatif quand la taille attendue est inconnue. */
  updateTransferService?(body: string, progress: number): boolean;
  stopTransferService?(): Promise<boolean>;
  addListener?(event: string, listener: () => void): { remove: () => void };
  /** Verdict `"ok" | "unusable" | "failed"` ; un ancien build rend encore un booléen. */
  finalizeMp4?(path: string): Promise<string | boolean>;
  promoteHevcTag?(path: string): Promise<boolean>;
}

export type FinalizeOutcome = "done" | "failed" | "unusable" | "unavailable";

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
export async function startTransferService(
  channelName: string,
  title: string,
  body: string,
  pauseLabel: string,
): Promise<boolean> {
  const module = transferServiceModule();
  if (module === null || module.startTransferService === undefined) return false;
  try {
    return await module.startTransferService(channelName, title, body, pauseLabel);
  } catch {
    // Un binaire antérieur au bouton « Pause » refuse le quatrième argument :
    // sans service, le moteur retombe sur l'anti-veille.
    return false;
  }
}

/** Corps et progression de la notification ; `false` sans service en cours. */
export function updateTransferService(body: string, progress: number): boolean {
  const module = transferServiceModule();
  if (module === null || module.updateTransferService === undefined) return false;
  try {
    return module.updateTransferService(body, progress);
  } catch {
    return false;
  }
}

/**
 * L'appui sur « Pause » dans la notification. Le natif ne touche pas à la
 * file : il prévient, et c'est le moteur qui met en pause.
 * Rend une fonction de retrait — sans module, elle ne fait rien.
 */
export function onTransferPause(listener: () => void): () => void {
  const module = transferServiceModule();
  if (module === null || typeof module.addListener !== "function") return () => {};
  try {
    const subscription = module.addListener("onTransferPause", listener);
    return () => subscription.remove();
  } catch {
    return () => {};
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

/**
 * Finalise un fichier Allégé : remux d'un MP4 fragmenté en MP4 indexé, et
 * promotion de l'entrée d'échantillon HEVC (voir `promoteHevcTag`).
 *
 * `unusable` dit que le fichier est arrivé SANS son index et qu'aucun remux ne
 * le sauvera — le moteur le retélécharge au lieu de s'acharner.
 * `unavailable` sans module ou sur un build qui l'ignore : le fichier reste tel
 * quel — le moteur ne le tient pas pour un échec.
 */
export async function finalizeMp4(path: string): Promise<FinalizeOutcome> {
  if (native === null || typeof native.finalizeMp4 !== "function") return "unavailable";
  try {
    const verdict = await native.finalizeMp4(path);
    // Un build antérieur au verdict rend un booléen : il ne sait rien dire
    // d'un fichier sans index, et son échec reste un échec ordinaire.
    if (typeof verdict === "boolean") return verdict ? "done" : "failed";
    if (verdict === "ok") return "done";
    return verdict === "unusable" ? "unusable" : "failed";
  } catch {
    return "failed";
  }
}

/**
 * Renomme l'entrée d'échantillon HEVC `hev1` en `hvc1`, sur place.
 *
 * AVFoundation n'ouvre le HEVC que sous `hvc1` : sous `hev1` — ce que produit
 * ffmpeg en copiant la vidéo — la piste existe, le son sort et l'image reste
 * NOIRE, sans la moindre erreur. Les deux formes ne diffèrent que par la place
 * des jeux de paramètres : quand le `hvcC` porte les siens, quatre octets
 * suffisent, sans réencodage. `false` si rien n'avait à changer.
 */
/** Le build embarque-t-il la promotion ? Sans elle, rien ne sert de balayer les titres. */
export function canPromoteHevcTag(): boolean {
  return native !== null && typeof native.promoteHevcTag === "function";
}

export async function promoteHevcTag(path: string): Promise<boolean> {
  if (native === null || typeof native.promoteHevcTag !== "function") return false;
  try {
    return await native.promoteHevcTag(path);
  } catch {
    return false;
  }
}
