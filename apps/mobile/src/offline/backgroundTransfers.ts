/**
 * Ce qui tient un transfert vivant quand l'écran s'éteint ou que l'application
 * passe derrière — et sa notification.
 *
 * - « Continuer en arrière-plan » ACTIVÉ : sur Android, le service de premier
 *   plan du module natif (notification « Transferts en cours · 2 titres en
 *   préparation · 43 % »), avec sa barre de progression et son bouton
 *   « Tout mettre en pause » — écran verrouillé, c'est le seul endroit d'où
 *   l'on peut arrêter un transfert ; sur iOS, rien à faire, la session
 *   d'arrière-plan d'expo-file-system survit à la suspension. Plus
 *   d'anti-veille : tenir l'écran allumé n'était que de la batterie perdue.
 * - DÉSACTIVÉ : l'anti-veille comme avant (l'écran tient le transfert), et
 *   `OfflineRuntimeSync` met tout en pause système quand l'application passe
 *   derrière.
 * - Le service refusé (Android 12+ le refuse depuis l'arrière-plan, Android
 *   15 après six heures de `dataSync` par jour) : repli sur l'anti-veille, le
 *   transfert continue en processus comme avant cette fonction.
 *
 * Limite connue : un transfert qui DÉMARRE l'application déjà derrière
 * (retour du Wi-Fi) ne peut pas lancer le service ; il tourne en processus et
 * reprend au retour au premier plan. Tenir le service en attente du Wi-Fi
 * brûlerait le quota et afficherait une notification permanente.
 *
 * Aucun minuteur ici : RN Android gèle `setTimeout` en arrière-plan. Le
 * rythme des mises à jour se compare à l'horloge.
 */

import { Platform } from "react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { i18n } from "@tentacle-tv/shared";
import type { ProgressPayload } from "@tentacle-tv/offline-core";
import {
  onTransferPause,
  startTransferService,
  stopTransferService,
  updateTransferService,
} from "../../modules/offline-storage";
import { ensureNotificationPermission } from "@/services/pushNotifications";
import { pauseAllTransfers } from "./engineApi";
import { isBackgroundTransfers } from "./settings";

const KEEP_AWAKE_TAG = "offline-transfer";
/** Au plus une mise à jour de la notification toutes les deux secondes. */
const NOTICE_MIN_INTERVAL_MS = 2_000;

let busy = false;
let serviceRunning = false;
let keepAwakeHeld = false;
/** Transferts en cours et en attente, d'après le moteur. */
let pending = 0;
/** La progression des fichiers vus pendant cette période d'activité. */
const seen = new Map<number, { bytesDone: number; expectedSize: number | null }>();
let lastNoticeAt = 0;
let unlistenPause: (() => void) | null = null;

/** Le pour-cent de l'ensemble, ou `-1` tant qu'aucune taille n'est connue. */
function noticePercent(): number {
  let done = 0;
  let total = 0;
  for (const file of seen.values()) {
    if (file.expectedSize === null || file.expectedSize <= 0) continue;
    done += Math.min(file.bytesDone, file.expectedSize);
    total += file.expectedSize;
  }
  return total > 0 ? Math.round((done / total) * 100) : -1;
}

function noticeBody(): string {
  const text = String(i18n.t("offline:transferNotifBody", { count: Math.max(1, pending) }));
  const percent = noticePercent();
  return percent < 0 ? text : `${text} · ${i18n.t("offline:transferNotifProgress", { percent })}`;
}

function holdKeepAwake(): void {
  if (keepAwakeHeld) return;
  keepAwakeHeld = true;
  activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
}

function releaseKeepAwake(): void {
  if (!keepAwakeHeld) return;
  keepAwakeHeld = false;
  deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
}

function releaseService(): void {
  if (!serviceRunning) return;
  serviceRunning = false;
  unlistenPause?.();
  unlistenPause = null;
  void stopTransferService();
}

/**
 * Le bouton « Pause » de la notification : le natif prévient, le moteur agit.
 * Un seul abonnement à la fois — le service peut redémarrer plusieurs fois
 * dans une même session.
 */
function listenToPauseButton(): void {
  if (unlistenPause !== null) return;
  unlistenPause = onTransferPause(() => {
    pauseAllTransfers();
  });
}

function notice(force: boolean): void {
  if (!serviceRunning) return;
  const now = Date.now();
  if (!force && now - lastNoticeAt < NOTICE_MIN_INTERVAL_MS) return;
  lastNoticeAt = now;
  updateTransferService(noticeBody(), noticePercent());
}

/** La bascule « au moins un transfert tourne » du moteur (`EngineDeps.onBusy`). */
export function onEngineBusy(active: boolean): void {
  busy = active;
  if (!active) {
    releaseKeepAwake();
    releaseService();
    seen.clear();
    lastNoticeAt = 0;
    return;
  }
  if (!isBackgroundTransfers()) {
    holdKeepAwake();
    return;
  }
  if (Platform.OS !== "android") return;
  // La permission n'est jamais attendue : le service tourne sans elle, seule
  // la notification resterait invisible.
  void ensureNotificationPermission();
  void startTransferService(
    String(i18n.t("offline:transferNotifChannel")),
    String(i18n.t("offline:transferNotifTitle")),
    noticeBody(),
    String(i18n.t("offline:pauseAll")),
  ).then((started) => {
    if (!busy) {
      if (started) void stopTransferService();
      return;
    }
    serviceRunning = started;
    if (started) listenToPauseButton();
    else holdKeepAwake();
  });
}

/** Progression brute d'un transfert (déjà étranglée par le cœur). */
export function onEngineProgress(payload: ProgressPayload): void {
  if (!busy) return;
  seen.set(payload.fileId, { bytesDone: payload.bytesDone, expectedSize: payload.expectedSize });
  notice(false);
}

/** Le compte de la notification, à chaque changement de la file. */
export function onEngineQueueChanged(next: number): void {
  if (next === pending) return;
  pending = next;
  if (busy) notice(true);
}

/** Déconnexion, changement de serveur, vidage du cache : tout est rendu. */
export function stopBackgroundTransfers(): void {
  busy = false;
  releaseKeepAwake();
  releaseService();
  seen.clear();
  pending = 0;
}
