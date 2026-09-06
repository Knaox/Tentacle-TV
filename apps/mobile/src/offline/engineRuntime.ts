/**
 * Le moteur hors ligne du mobile, et ce qui l'entoure : le pilote expo, la
 * base et la racine locales, l'anti-veille de l'écran pendant un transfert,
 * la purge des échéances et la réparation au démarrage.
 *
 * Singleton de module, construit au premier appel : un utilisateur qui ne
 * garde rien hors ligne n'ouvre ni base ni dossier. Les évènements du moteur
 * (`downloads://changed`, `downloads://progress`) sont rendus à l'interface
 * par deux abonnements — l'équivalent du canal IPC du bureau.
 */

import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import {
  DownloadEngine,
  heal,
  purgeDueClaims,
  type Creds,
  type EngineEvent,
  type ProgressPayload,
} from "@tentacle-tv/offline-core";
import { setExcludedFromBackup } from "../../modules/offline-storage";
import { isOfflineMode } from "./connectivityStore";
import { localDb } from "./database";
import { canStartTransfers } from "./transferGate";
import { expoFileStore } from "./expoFileStore";
import { createExpoTransferDriver } from "./expoTransferDriver";
import { makeFetcher } from "./fetcher";
import { resumeTokens } from "./resumeTokens";
import { offlineVolume } from "./volume";

/** Tour de purge, comme le bureau. */
const PURGE_TICK_MS = 60_000;
const KEEP_AWAKE_TAG = "offline-transfer";

const changedListeners = new Set<() => void>();
const progressListeners = new Set<(payload: ProgressPayload) => void>();

/** « Quelque chose a changé » : les listes locales se rechargent. */
export function subscribeOfflineChanged(listener: () => void): () => void {
  changedListeners.add(listener);
  return () => {
    changedListeners.delete(listener);
  };
}

/** Progression brute d'un transfert (déjà étranglée par le cœur). */
export function subscribeOfflineProgress(listener: (payload: ProgressPayload) => void): () => void {
  progressListeners.add(listener);
  return () => {
    progressListeners.delete(listener);
  };
}

export function notifyOfflineChanged(): void {
  // Certaines opérations système remettent l'attribut « ne pas sauvegarder »
  // à zéro : on le repose à chaque changement — une fin de transfert en est un.
  try {
    setExcludedFromBackup(offlineVolume().root, true);
  } catch {
    // Sans racine (jamais créée), rien à exclure.
  }
  for (const listener of changedListeners) listener();
}

function emit(event: EngineEvent, payload: unknown): void {
  if (event === "downloads://changed") {
    notifyOfflineChanged();
    return;
  }
  for (const listener of progressListeners) listener(payload as ProgressPayload);
}

let engine: DownloadEngine | null = null;
let purgeTimer: ReturnType<typeof setInterval> | null = null;
let creds: Creds | null = null;

/** Le moteur, construit au premier appel. */
export function offlineEngine(): DownloadEngine {
  if (engine !== null) return engine;
  engine = new DownloadEngine({
    db: localDb(),
    volume: offlineVolume,
    driver: createExpoTransferDriver(expoFileStore, resumeTokens),
    makeFetcher,
    emit,
    now: () => Date.now(),
    // Wi-Fi seulement, réseau identifié, serveur joignable : la garde est
    // consultée à chaque relance, jamais mise en cache.
    canTransfer: canStartTransfers,
    // L'écran reste allumé tant qu'un transfert tourne : un téléphone qui se
    // verrouille suspend l'application, et le flux avec elle (sauf iOS, dont
    // la session d'arrière-plan continue).
    onBusy: (busy) => {
      if (busy) activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
      else deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    },
    onStarted: (started) => {
      startPeriodicPurge();
      // Hors ligne, la réparation n'aurait que des requêtes à faire échouer.
      if (!isOfflineMode()) runHeal(started);
    },
  });
  return engine;
}

/** Le moteur s'il existe déjà — sans le construire (ni ouvrir la base). */
export function offlineEngineIfStarted(): DownloadEngine | null {
  return engine;
}

/** Identifiants connus du runtime (`null` avant le premier démarrage en ligne). */
export function offlineCreds(): Creds | null {
  return creds;
}

/**
 * Démarrage ou reconnexion : pose les identifiants, normalise la file et
 * relance. À appeler à chaque passage en ligne et à chaque changement de
 * compte — `start` est prévu pour être rappelé.
 */
export function startOfflineRuntime(next: Creds): void {
  creds = next;
  offlineEngine().start(next);
}

/** Jeton rafraîchi : les transferts suivants l'utilisent, sans re-normaliser. */
export function updateOfflineCreds(next: Creds): void {
  creds = next;
  engine?.setCreds(next);
}

/**
 * Purge des échéances d'auto-suppression. Première itération IMMÉDIATE (elle
 * rattrape ce qui est arrivé à échéance pendant que l'application était
 * fermée), puis un tour par minute — et un tour à chaque retour au premier
 * plan, parce qu'iOS gèle les minuteurs d'une application en arrière-plan.
 */
export function purgeTick(): void {
  try {
    if (purgeDueClaims(localDb(), offlineVolume(), Date.now(), null) > 0) notifyOfflineChanged();
  } catch {
    // Base ou racine indisponible : on retentera au prochain tour.
  }
}

function startPeriodicPurge(): void {
  if (purgeTimer !== null) return;
  purgeTick();
  purgeTimer = setInterval(purgeTick, PURGE_TICK_MS);
}

/** Réparation en tâche de fond, jamais attendue. */
function runHeal(started: Creds): void {
  void heal(makeFetcher(started.token), localDb(), started.serverUrl, offlineVolume(), Date.now())
    .then((healed) => {
      if (healed > 0) notifyOfflineChanged();
    })
    .catch(() => {
      // Best-effort : elle repassera au prochain démarrage.
    });
}

/** Arrête le minuteur de purge et rend l'anti-veille. */
export function stopOfflineRuntime(): void {
  if (purgeTimer !== null) clearInterval(purgeTimer);
  purgeTimer = null;
  deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
}
