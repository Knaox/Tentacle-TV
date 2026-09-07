/**
 * Le moteur hors ligne du mobile, et ce qui l'entoure : le pilote expo, la
 * base et la racine locales, ce qui tient un transfert vivant en arrière-plan
 * (`backgroundTransfers.ts`), la purge des échéances et la réparation au
 * démarrage.
 *
 * Singleton de module, construit au premier appel : un utilisateur qui ne
 * garde rien hors ligne n'ouvre ni base ni dossier. Les évènements du moteur
 * (`downloads://changed`, `downloads://progress`) sont rendus à l'interface
 * par deux abonnements — l'équivalent du canal IPC du bureau.
 */

import {
  DownloadEngine,
  heal,
  purgeDueClaims,
  repairUsage,
  type Creds,
  type EngineEvent,
  type FinalizeVerdict,
  type ProgressPayload,
} from "@tentacle-tv/offline-core";
import { finalizeMp4, setExcludedFromBackup } from "../../modules/offline-storage";
import { onEngineBusy, onEngineProgress, onEngineQueueChanged, stopBackgroundTransfers } from "./backgroundTransfers";
import { isOfflineMode } from "./connectivityStore";
import { localDb } from "./database";
import { nowPlayingItemId } from "./nowPlaying";
import { transferParallelLimit } from "./backgroundParallel";
import { canStartTransfers } from "./transferGate";
import { expoFileStore } from "./expoFileStore";
import { runHevcRepair } from "./hevcRepair";
import { createExpoTransferDriver } from "./expoTransferDriver";
import { makeFetcher } from "./fetcher";
import { resumeTokens } from "./resumeTokens";
import { offlineVolume } from "./volume";

/** Tour de purge, comme le bureau. */
const PURGE_TICK_MS = 60_000;

const changedListeners = new Set<() => void>();
const progressListeners = new Set<(payload: ProgressPayload) => void>();
const playbackListeners = new Set<() => void>();

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

/**
 * La progression LOCALE a changé (position, vu) : les listes et états se
 * rechargent — jamais la source du lecteur, qui rechargerait le média.
 */
export function subscribeOfflinePlaybackChanged(listener: () => void): () => void {
  playbackListeners.add(listener);
  return () => {
    playbackListeners.delete(listener);
  };
}

export function notifyOfflinePlaybackChanged(): void {
  for (const listener of playbackListeners) listener();
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
    onEngineQueueChanged(engine?.pending() ?? 0);
    return;
  }
  const progress = payload as ProgressPayload;
  for (const listener of progressListeners) listener(progress);
  onEngineProgress(progress);
}

let engine: DownloadEngine | null = null;
let purgeTimer: ReturnType<typeof setInterval> | null = null;
let creds: Creds | null = null;

async function finalizeLightFile(absPath: string): Promise<FinalizeVerdict> {
  const outcome = await finalizeMp4(absPath);
  // Un fichier arrivé sans son index n'est pas un remux raté : le moteur le
  // jette et repart du transfert plutôt que de rejouer un remux impossible.
  if (outcome === "unusable") return "unusable";
  if (outcome === "failed") throw new Error("finalizeMp4 failed");
  return "ok";
}

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
    // Un seul transfert à la fois quand l'application est là ; plusieurs le
    // temps d'une suspension iOS, où rien de neuf ne peut plus partir.
    parallelLimit: transferParallelLimit,
    // Le fichier Allégé est un MP4 fragmenté : remux indexé par le module natif
    // avant « complete » ; sans module (ancien build), il reste tel quel.
    finalizeMedia: finalizeLightFile,
    // Service de premier plan Android, session d'arrière-plan iOS ou
    // anti-veille de l'écran : voir `backgroundTransfers.ts`.
    onBusy: onEngineBusy,
    // Le statut en base ne dira que « imprévu » : la cause ne vit que là.
    onUnexpected: (context, error) => {
      console.warn(`[transferts] ${context} : ${String(error)}`);
    },
    onStarted: (started) => {
      startPeriodicPurge();
      // Le disque, lui, est toujours là : ces deux passes tournent même hors
      // ligne, contrairement à `heal` qui a besoin du serveur.
      runUsageRepair();
      runHevcRepair();
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
    if (purgeDueClaims(localDb(), offlineVolume(), Date.now(), null, nowPlayingItemId()) > 0) notifyOfflineChanged();
  } catch {
    // Base ou racine indisponible : on retentera au prochain tour.
  }
}

function startPeriodicPurge(): void {
  if (purgeTimer !== null) return;
  purgeTick();
  purgeTimer = setInterval(purgeTick, PURGE_TICK_MS);
}

/**
 * Recale l'espace occupé sur ce qui est réellement sur l'appareil, et efface
 * ce qui n'a plus de propriétaire — un remux tué laisse son temporaire, une
 * suppression interrompue laisse son média.
 */
function runUsageRepair(): void {
  const running = engine;
  if (running === null) return;
  const alive = new Set<number>();
  for (const row of localDb().prepare("SELECT id FROM files WHERE status = 'downloading'").all()) {
    const id = Number(row["id"]);
    if (running.isActive(id)) alive.add(id);
  }
  try {
    const report = repairUsage(localDb(), offlineVolume(), Date.now(), {
      skipFileIds: alive,
      removeOrphans: true,
    });
    if (report.rebased + report.missing + report.removed > 0) notifyOfflineChanged();
  } catch {
    // Best-effort : elle repassera au prochain démarrage.
  }
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

/** Arrête le minuteur de purge et rend le service, la notification et l'anti-veille. */
export function stopOfflineRuntime(): void {
  if (purgeTimer !== null) clearInterval(purgeTimer);
  purgeTimer = null;
  stopBackgroundTransfers();
}
