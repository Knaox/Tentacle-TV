/**
 * Le pilote de transfert du mobile : le téléchargeur natif d'expo-file-system
 * (module hérité, `createDownloadResumable`) derrière le `TransferDriver` du
 * cœur. La politique — reprise, intégrité, arrêt du transcodage, codes
 * d'erreur — reste dans le cœur ; ce fichier tire un flux dans le `.part`.
 *
 * Deux natifs, deux comportements, lus dans les sources d'expo-file-system :
 * - **Android** pose lui-même `Range: bytes=<resumeData>-` et AJOUTE au fichier
 *   existant sans regarder le statut. Un 200 malgré la reprise donnerait un
 *   fichier corrompu : on le jette et on rend `range-ignored`. La progression
 *   rendue est déjà cumulée (`bytesRead + resumeData`).
 * - **iOS** n'écrit le fichier qu'à la FIN (rien sur le disque avant). La
 *   reprise passe par un jeton opaque : celui d'une pause, gardé dans la base
 *   locale (`resumeTokens`), ou celui qu'une COUPURE laisse à côté du `.part`
 *   (`resumeSidecar`, rendu possible par `patches/expo-file-system.patch`).
 *   Un jeton périmé (conteneur renommé à une mise à jour) fait échouer la
 *   reprise → on l'oublie, la politique repart de zéro.
 * - Sur les deux, les en-têtes de réponse n'arrivent qu'à la résolution :
 *   `onHeaders` n'est jamais appelé — la session de transcodage est choisie
 *   par le client (voir `worker.ts`) et le serveur l'honore.
 */

import { Platform } from "react-native";
import { createDownloadResumable, FileSystemSessionType } from "expo-file-system/legacy";
import type { FileStore, TransferDriver, TransferOutcome, TransferRequest } from "@tentacle-tv/offline-core";
import { dropResumeSidecar, readResumeSidecar } from "./resumeSidecar";
import type { ResumeTokenStore } from "./resumeTokens";
import { isBackgroundTransfers } from "./settings";

const IS_ANDROID = Platform.OS === "android";

export function createExpoTransferDriver(files: FileStore, tokens: ResumeTokenStore): TransferDriver {
  return {
    download: (request) => download(files, tokens, request),
    stopTranscode: async (url, headers) => {
      try {
        await fetch(url, { method: "DELETE", headers });
      } catch {
        // Best-effort : Jellyfin finira par libérer la session tout seul.
      }
    },
    forget: (partPath) => tokens.forget(partPath),
  };
}

/** Jette un `.part` ; déjà absent : rien de mieux à faire ici. */
function discard(files: FileStore, partPath: string): void {
  try {
    files.remove(partPath);
  } catch {
    // Un `.part` qui reste sera jeté au prochain passage.
  }
}

function lowercaseKeys(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) out[name.toLowerCase()] = value;
  return out;
}

/** Jeton d'une pause, sinon celui d'une coupure — consommé au passage. */
async function pickResumeToken(tokens: ResumeTokenStore, partPath: string): Promise<string | null> {
  const paused = tokens.get(partPath);
  if (paused !== null) return paused;
  const afterOutage = await readResumeSidecar(partPath);
  if (afterOutage !== null) await dropResumeSidecar(partPath);
  return afterOutage;
}

async function download(
  files: FileStore,
  tokens: ResumeTokenStore,
  request: TransferRequest,
): Promise<TransferOutcome> {
  // iOS : d'abord le jeton d'une pause explicite, sinon celui qu'une coupure a
  // laissé à côté du `.part` — sans lui, une erreur réseau coûtait le fichier
  // entier. Ce dernier ne sert QU'UNE fois : consommé tout de suite, il ne peut
  // pas boucler s'il est périmé, et le natif en réécrira un frais au prochain
  // échec s'il en a un.
  const resumeToken = IS_ANDROID ? null : await pickResumeToken(tokens, request.partPath);
  const resumeData = IS_ANDROID
    ? request.resumeFrom > 0
      ? String(request.resumeFrom)
      : undefined
    : (resumeToken ?? undefined);

  let bytesKnown = request.resumeFrom;
  // iOS : la session d'arrière-plan continue une fois l'application
  // suspendue ; « Continuer en arrière-plan » désactivé, on respecte le choix
  // avec une session de premier plan (lue à la création de la tâche).
  const sessionType = isBackgroundTransfers() ? FileSystemSessionType.BACKGROUND : FileSystemSessionType.FOREGROUND;
  const task = createDownloadResumable(
    request.url,
    request.partPath,
    { headers: request.headers, sessionType },
    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      bytesKnown = totalBytesWritten;
      request.onBytes(totalBytesWritten);
      // iOS rend -1 quand la longueur est inconnue (transcodage progressif au
      // tout début) ; la politique ignore aussi les valeurs répétées.
      if (totalBytesExpectedToWrite > 0) {
        request.onTotal?.(request.resumeFrom + totalBytesExpectedToWrite);
      }
    },
    resumeData,
  );

  // Les bascules du moteur, observées par abonnement : un flux figé ne rend
  // plus la main. La pause rend le jeton de reprise (iOS) ; l'annulation coupe.
  let pausing: Promise<void> | null = null;
  const react = (): void => {
    if (request.signal.cancel) {
      void task.cancelAsync().catch(() => undefined);
      return;
    }
    if (request.signal.pause && pausing === null) {
      pausing = task
        .pauseAsync()
        .then((state) => {
          if (!IS_ANDROID && state.resumeData) tokens.set(request.partPath, state.resumeData);
        })
        .catch(() => undefined);
    }
  };
  const unsubscribe = request.signal.subscribe(react);

  let result;
  try {
    // Bascule déjà posée avant que le transfert ne démarre : on ne lance rien.
    if (request.signal.cancel) {
      discard(files, request.partPath);
      return { kind: "canceled" };
    }
    if (request.signal.pause) return { kind: "paused", bytesKnown };
    result = await task.downloadAsync();
  } catch (error) {
    if (request.signal.cancel) {
      discard(files, request.partPath);
      return { kind: "canceled" };
    }
    if (request.signal.pause) return { kind: "paused", bytesKnown };
    // Reprise iOS refusée (jeton périmé) : on l'oublie, la politique repartira
    // de zéro. Le natif vient d'écrire un jeton frais à côté du `.part` :
    // c'est lui qui servira au prochain essai.
    if (resumeToken !== null) tokens.forget(request.partPath);
    const cause = files.classify(error) === "disk-full" ? "disk-full" : "network";
    return { kind: "failed", cause, bytesKnown };
  } finally {
    unsubscribe();
  }
  // Le jeton doit être rangé AVANT de rendre la main : le moteur relit la base.
  if (pausing !== null) await pausing;

  if (result === undefined) {
    if (request.signal.cancel) {
      discard(files, request.partPath);
      if (!IS_ANDROID) {
        tokens.forget(request.partPath);
        void dropResumeSidecar(request.partPath);
      }
      return { kind: "canceled" };
    }
    if (request.signal.pause) return { kind: "paused", bytesKnown };
    // Coupé sans bascule : le natif a abandonné — pause SYSTÈME côté politique.
    return { kind: "failed", cause: "network", bytesKnown };
  }

  // Transfert terminé : le jeton de reprise ne sert plus.
  if (!IS_ANDROID) {
    tokens.forget(request.partPath);
    void dropResumeSidecar(request.partPath);
  }

  // Android a AJOUTÉ un corps complet à la suite du `.part` : corrompu.
  if (IS_ANDROID && result.status === 200 && request.resumeFrom > 0) {
    discard(files, request.partPath);
    return { kind: "failed", cause: "range-ignored", bytesKnown: 0 };
  }

  const headers = lowercaseKeys(result.headers ?? {});
  return {
    kind: "done",
    status: result.status,
    header: (name) => headers[name.toLowerCase()] ?? null,
  };
}
