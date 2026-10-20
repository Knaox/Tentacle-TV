/**
 * Le suivi en direct des transferts : il écoute le moteur (changements de la
 * file, progression), le réseau et les réglages, fait passer le tout par les
 * règles pures d'offline-core (`liveTransferView` puis `nextLivePublish`) et
 * applique la décision à la surface de la plateforme.
 *
 * Singleton de module, hors React : sur Android, le service de premier plan
 * garde le JavaScript vivant écran éteint, et les évènements du moteur
 * arrivent sans qu'aucun écran ne rende. Démarré par `OfflineLiveActivity`
 * (le compte courant), arrêté à la déconnexion.
 *
 * La liste locale n'est relue qu'à un CHANGEMENT de la file (une requête
 * SQLite) ; une progression ne fait que relire le magasin des barres.
 */

import {
  INITIAL_LIVE_STATE,
  liveTransferView,
  nextLiveBatch,
  nextLivePublish,
  type LiveContent,
  type LiveNetworkWait,
  type LivePublishState,
} from "@tentacle-tv/offline-core";
import { getProgressFor } from "@tentacle-tv/offline-core/react";
import { i18n } from "@tentacle-tv/shared";
import { getConnectivitySnapshot, isOfflineMode, subscribeConnectivity } from "../connectivityStore";
import { isCellularAcked, isLiveTransfers, subscribeDeviceSettings } from "../deviceSettings";
import { listOfflineEntries, type OfflineEntry } from "../engineApi";
import { subscribeOfflineChanged, subscribeOfflineProgress } from "../engineRuntime";
import { entryTitle } from "../entryTitle";
import { isWifiOnly, subscribeOfflineSettings } from "../settings";
import { wifiBlocked } from "../transferGate";
import { liveTexts } from "./liveText";
import { platformLiveSurface, type LiveSurface } from "./liveSurface";

let surface: LiveSurface = platformLiveSurface();
let userId: string | null = null;
let entries: OfflineEntry[] = [];
let batch: Set<number> = new Set();
let state: LivePublishState = INITIAL_LIVE_STATE;
/** Le texte d'état affiché : sur Android, « Prêt dans 12 min » se réécrit quand la minute change. */
let shownStatus: string | null = null;
let unsubscribers: Array<() => void> = [];

/** Ce que le réseau impose au lot — la règle « Wi-Fi seulement » d'abord, puis le serveur injoignable. */
function currentWait(): LiveNetworkWait {
  const networkType = getConnectivitySnapshot().networkType;
  if (wifiBlocked({ wifiOnly: isWifiOnly(), networkType, cellularAck: isCellularAcked() })) return "wifi";
  return isOfflineMode() ? "network" : null;
}

function titleOf(itemId: string): string | null {
  const entry = entries.find((candidate) => candidate.itemId === itemId);
  return entry ? entryTitle(entry) : null;
}

const translate = (key: string, params?: Record<string, unknown>): string => String(i18n.t(key, params));

function render(content: LiveContent, nowMs: number): void {
  const texts = liveTexts(content, nowMs, translate, titleOf);
  shownStatus = texts.status;
  surface.show(content, texts, translate("offline:transferNotifChannel"));
}

function clear(): void {
  if (state.shown !== null) surface.end();
  state = INITIAL_LIVE_STATE;
  shownStatus = null;
}

/** Un pas : relit l'état, décide, applique. `nowMs` injecté pour les tests. */
export function recomputeLive(nowMs: number = Date.now()): void {
  if (userId === null || !isLiveTransfers() || !surface.available()) {
    clear();
    batch = new Set();
    return;
  }
  batch = nextLiveBatch(batch, entries);
  const view = liveTransferView({ entries, batch, progress: getProgressFor, wait: currentWait() });
  const step = nextLivePublish(state, view, nowMs);
  state = step.state;
  const action = step.action;
  if (action.kind === "start" || action.kind === "update") {
    render(action.content, nowMs);
  } else if (action.kind === "end") {
    surface.end();
    shownStatus = null;
  } else if (state.shown !== null && state.shown.phase === "transferring") {
    // Rien de neuf pour la règle ; la minute affichée en toutes lettres a pu changer.
    const status = liveTexts(state.shown, nowMs, translate, titleOf).status;
    if (status !== shownStatus) render(state.shown, nowMs);
  }
}

function reloadEntries(): void {
  try {
    entries = userId === null ? [] : listOfflineEntries(userId);
  } catch {
    // Base indisponible (déconnexion en cours) : rien à suivre.
    entries = [];
  }
}

/** Démarre le suivi pour ce compte ; une activité orpheline d'un lancement d'avant est effacée. */
export function startLiveTransfers(nextUserId: string): () => void {
  stopLiveTransfers();
  userId = nextUserId;
  reloadEntries();
  unsubscribers = [
    subscribeOfflineChanged(() => {
      reloadEntries();
      recomputeLive();
    }),
    subscribeOfflineProgress(() => recomputeLive()),
    subscribeConnectivity(() => recomputeLive()),
    subscribeOfflineSettings(() => recomputeLive()),
    subscribeDeviceSettings(() => recomputeLive()),
  ];
  recomputeLive();
  // Rien à suivre : une activité laissée par un lancement d'avant (l'app tuée
  // en plein transfert) est effacée. S'il y a un lot, `present` l'a reprise.
  if (state.shown === null) surface.end();
  return stopLiveTransfers;
}

export function stopLiveTransfers(): void {
  for (const unsubscribe of unsubscribers) unsubscribe();
  unsubscribers = [];
  clear();
  userId = null;
  entries = [];
  batch = new Set();
}

/** Tests seulement : une surface factice. */
export function setLiveSurfaceForTests(next: LiveSurface): void {
  surface = next;
}
