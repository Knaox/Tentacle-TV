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

import { AppState, type AppStateStatus } from "react-native";
import {
  INITIAL_LIVE_STATE,
  LIVE_BACKGROUND_RELEASE_DELAY_MS,
  liveAppStateAction,
  liveRetryOnTick,
  liveTransferView,
  liveWantsBackgroundTime,
  nextLiveBatch,
  nextLivePublish,
  type LiveAppState,
  type LiveContent,
  type LiveNetworkWait,
  type LivePublishState,
  type LiveSurfaceOutcome,
} from "@tentacle-tv/offline-core";
import { getProgressFor, subscribeProgress } from "@tentacle-tv/offline-core/react";
import { i18n } from "@tentacle-tv/shared";
import { getConnectivitySnapshot, isOfflineMode, subscribeConnectivity } from "../connectivityStore";
import { isCellularAcked, isLiveTransfers, subscribeDeviceSettings } from "../deviceSettings";
import { listOfflineEntries, type OfflineEntry } from "../engineApi";
import { subscribeOfflineChanged } from "../engineRuntime";
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
/**
 * Ce que le système a fait du dernier dessin. Un `refused` (iOS ne démarre une
 * Live Activity qu'au premier plan) se retente : au retour au premier plan,
 * et au fil des évènements tant que l'app est là (`liveSurfaceRepair.ts`).
 */
let outcome: LiveSurfaceOutcome = "pending";
let lastAttemptMs = 0;
/** Seul le verdict du DERNIER dessin compte : un plus ancien qui répond tard est ignoré. */
let renderSeq = 0;
/** Le délai d'arrière-plan d'iOS est-il tenu ? */
let timeHeld = false;
/**
 * Une session de PROFIL est ouverte : le hors ligne appartient au compte de
 * l'appareil (règle de Damien, 20/10), le profil n'en voit rien — ni activité,
 * ni notification. Le lot du compte, lui, continue en coulisse, et se montre
 * à nouveau au retour sur le compte.
 */
let hidden = false;

function liveAppState(status: AppStateStatus | null | undefined): LiveAppState {
  return status === "active" || status === "inactive" || status === "background" || status === "extension" ? status : "unknown";
}

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
  lastAttemptMs = nowMs;
  const seq = ++renderSeq;
  outcome = "pending";
  void surface.show(content, texts, translate("offline:transferNotifChannel"), nowMs).then((result) => {
    if (seq === renderSeq) outcome = result;
  });
}

/** Plus d'activité : les verdicts en vol ne comptent plus. */
function forgetSurface(): void {
  renderSeq += 1;
  outcome = "pending";
  shownStatus = null;
}

function clear(): void {
  if (state.shown !== null) surface.end();
  state = INITIAL_LIVE_STATE;
  forgetSurface();
}

/**
 * Un pas : relit l'état, décide, applique. `nowMs` injecté pour les tests ;
 * `force` redessine l'état du moment même sans changement notable.
 */
export function recomputeLive(nowMs: number = Date.now(), force = false): void {
  step(nowMs, force);
  syncBackgroundTime();
}

function step(nowMs: number, force: boolean): void {
  if (userId === null || !isLiveTransfers() || !surface.available()) {
    clear();
    batch = new Set();
    return;
  }
  if (hidden) {
    // Le lot est gardé : il reprend sa place au retour sur le compte.
    batch = nextLiveBatch(batch, entries);
    clear();
    return;
  }
  batch = nextLiveBatch(batch, entries);
  const view = liveTransferView({ entries, batch, progress: getProgressFor, wait: currentWait() });
  const decision = nextLivePublish(state, view, nowMs, { force });
  state = decision.state;
  const action = decision.action;
  if (action.kind === "start" || action.kind === "update") {
    render(action.content, nowMs);
  } else if (action.kind === "end") {
    surface.end();
    forgetSurface();
  } else if (
    state.shown !== null &&
    liveRetryOnTick({ appState: liveAppState(AppState.currentState), outcome, sinceLastAttemptMs: nowMs - lastAttemptMs })
  ) {
    // Démarrage refusé, app au premier plan : une nouvelle chance.
    render(state.shown, nowMs);
  } else if (state.shown !== null && state.shown.phase === "transferring") {
    // Rien de neuf pour la règle ; la minute affichée en toutes lettres a pu changer.
    const status = liveTexts(state.shown, nowMs, translate, titleOf).status;
    if (status !== shownStatus) render(state.shown, nowMs);
  }
}

/**
 * Derrière, tant que l'activité estime encore (ou finalise), quelques
 * secondes de plus ; rendues dès qu'un temps restant est publié.
 */
function syncBackgroundTime(status: AppStateStatus | null | undefined = AppState.currentState): void {
  const wants = userId !== null && liveWantsBackgroundTime({ appState: liveAppState(status), shownPhase: state.shown?.phase ?? null });
  if (wants === timeHeld) return;
  timeHeld = wants;
  if (wants) {
    surface.holdTime();
  } else {
    const held = surface;
    setTimeout(() => {
      if (!timeHeld) held.releaseTime();
    }, LIVE_BACKGROUND_RELEASE_DELAY_MS);
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

/**
 * Premier plan, arrière-plan : la Live Activity refusée se repose au retour
 * (seule fenêtre où iOS l'accepte), l'état du moment se publie avant la
 * suspension du JavaScript.
 */
function subscribeAppState(): () => void {
  const subscription = AppState.addEventListener("change", (status) => {
    const action = liveAppStateAction({ appState: liveAppState(status), wanted: state.shown !== null, outcome });
    if (action === "republish") step(Date.now(), true);
    syncBackgroundTime(status);
  });
  return () => subscription.remove();
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
    // Le MAGASIN des barres, pas l'évènement brut du moteur : celui-ci nourrit
    // le magasin par un autre abonné, et l'ordre des abonnés décidait si l'on
    // lisait le débit à jour ou celui d'avant.
    subscribeProgress(() => recomputeLive()),
    subscribeConnectivity(() => recomputeLive()),
    subscribeOfflineSettings(() => recomputeLive()),
    subscribeDeviceSettings(() => recomputeLive()),
    subscribeAppState(),
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
  syncBackgroundTime();
}

/** Session de profil ouverte (`true`) ou retour sur le compte : voir `hidden`. */
export function setLiveHidden(next: boolean): void {
  if (hidden === next) return;
  hidden = next;
  recomputeLive(Date.now(), true);
}

/** Tests seulement : une surface factice. */
export function setLiveSurfaceForTests(next: LiveSurface): void {
  surface = next;
}
