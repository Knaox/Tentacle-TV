/**
 * Ce que la coquille native sait réellement faire.
 *
 * # Pourquoi ce fichier existe
 *
 * Les trois systèmes n'implémentent pas le même inventaire : les mises à jour du
 * Microsoft Store n'existent que sous Windows, la sonde de surface que sur macOS
 * en développement. Sans porte, l'interface afficherait des boutons dont l'appel
 * est rejeté — l'utilisateur voit une fonctionnalité qui ne répond pas, et la
 * console se remplit d'erreurs qui masquent les vraies.
 *
 * Le processus principal annonce donc les commandes qu'il a branchées, et
 * l'interface demande ici « sais-tu télécharger ? » plutôt que « sur quel
 * système tourne-je ? ». La liste suit ce qui est réellement enregistré : rien à
 * tenir à jour à la main.
 *
 * ⚠️ Le revers, et il est silencieux : une commande oubliée côté principal fait
 * disparaître une section ENTIÈRE de l'interface, sans erreur nulle part. C'est
 * pourquoi le démarrage NOMME les commandes manquantes (`index.ts`).
 */

import { desktopKind } from "./detect";
import { isAppStoreBuild } from "./channel";

/** La coquille expose-t-elle cette commande ? */
function hasNativeCommand(command: string): boolean {
  if (desktopKind() !== "electron") return false;
  return window.tentacle?.capabilities.includes(command) ?? false;
}

/** Téléchargements et lecture hors ligne (moteur, catalogue local, purge). */
export function supportsDownloads(): boolean {
  return hasNativeCommand("downloads_list");
}

/** Lecteur mpv natif. Sinon, l'app retombe sur le lecteur web (hls.js). */
export function supportsMpv(): boolean {
  return hasNativeCommand("mpv_init");
}

/** Contrôles média du système (SMTC sous Windows). */
export function supportsSmtc(): boolean {
  return hasNativeCommand("smtc_init");
}

/**
 * L'application peut-elle proposer sa propre mise à jour ?
 *
 * Deux cas, et le premier ne demande RIEN au shell : sur un build App Store, la
 * détection est un manifeste HTTP et l'action une ouverture d'URL. Sans cette
 * porte, la coquille Electron de macOS répondait « non » — elle n'enregistre pas
 * `check_msix_update`, et c'est justifié, cette commande est Windows —, si bien
 * que la pop-up ne s'affichait jamais alors que tout ce qu'il lui faut existe.
 *
 * Le second cas reste l'inventaire des commandes : sous Windows c'est WinRT qui
 * découvre la mise à jour en attente et la déclenche depuis l'application ; sous
 * Linux, où il n'y a pas de guichet, c'est notre updater — et c'est la détection
 * du format installé qui commande, puisque sans elle on ne propose rien.
 */
export function supportsAppUpdates(): boolean {
  if (isAppStoreBuild()) return true;
  return hasNativeCommand("check_msix_update") || hasNativeCommand("detect_linux_install_format");
}

/** Session hors ligne conservée par le natif (cache de session, avatars). */
export function supportsOfflineSession(): boolean {
  return hasNativeCommand("session_cache_get");
}

/**
 * Sonde de la surface vidéo : géométrie, plage étendue, COMPTAGE DES PIXELS.
 *
 * ⚠️ Tauri répond « oui » à tout (voir `hasNativeCommand`) : elle n'y existe
 * pourtant pas. Le garde `isElectronShell` est donc indispensable ici, là où il
 * ne l'est pas pour les autres capacités — celles-ci sont bien servies par les
 * deux coquilles. Branchée par la coquille Electron sur macOS, en développement
 * seulement : elle lance `screencapture`.
 */
export function supportsSurfaceProbe(): boolean {
  return desktopKind() === "electron" && hasNativeCommand("video_surface_probe");
}
