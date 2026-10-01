import { useSyncExternalStore } from "react";
import type { Culprit, RecoveryPhase, StartupWaitHint } from "@tentacle-tv/tv-core";

/** L'ouverture d'un transcodage qui se fait attendre (`useStartupWait`) : ce
 *  que dit l'écran d'ouverture, ou l'échec par l'attente (`gaveUp`). */
export type StartWait = StartupWaitHint | { kind: "gaveUp" };

/**
 * L'état de la reprise d'une lecture, lisible par l'HABILLAGE : le crochet de
 * reprise (`usePlaybackRecovery`, monté par le gestionnaire d'erreurs du
 * lecteur) l'écrit ; le message-outil de la refonte le lit. Un seul lecteur à
 * la fois — l'écran le remet à zéro en partant.
 */
export interface PlaybackTroubleState {
  phase: RecoveryPhase;
  /** Prochaine vérification du serveur (horodatage), pendant un incident. */
  nextCheckAt: number | null;
  /** Une vérification est en cours. */
  checking: boolean;
  /** La dernière vérification demandée à la main a trouvé le serveur muet. */
  stillDown: boolean;
  /** L'OUVERTURE a échoué serveur à terre : qui manque (sinon `null`). */
  startCulprit: Culprit | null;
  /** L'ouverture d'un transcodage qui se fait attendre (sinon `null`). */
  startWait: StartWait | null;
}

export const IDLE_TROUBLE: PlaybackTroubleState = {
  phase: { kind: "none" }, nextCheckAt: null, checking: false, stillDown: false, startCulprit: null, startWait: null,
};

let current: PlaybackTroubleState = IDLE_TROUBLE;
const listeners = new Set<() => void>();
let retryNow: (() => void) | null = null;

function same(a: PlaybackTroubleState, b: PlaybackTroubleState): boolean {
  const pa = a.phase as Record<string, unknown>;
  const pb = b.phase as Record<string, unknown>;
  return a.nextCheckAt === b.nextCheckAt && a.checking === b.checking && a.stillDown === b.stillDown
    && a.startCulprit === b.startCulprit && a.startWait?.kind === b.startWait?.kind
    && pa.kind === pb.kind && pa.cause === pb.cause && pa.since === pb.since && pa.ahead === pb.ahead
    && pa.streamAffected === pb.streamAffected
    && (pa.network as { measuredBps?: number } | undefined)?.measuredBps === (pb.network as { measuredBps?: number } | undefined)?.measuredBps;
}

/** Réservé au crochet de reprise. */
export function publishPlaybackTrouble(next: PlaybackTroubleState): void {
  if (same(current, next)) return;
  current = next;
  listeners.forEach((listener) => listener());
}

/** Réservé au crochet de reprise : le geste « Réessayer » de l'habillage. */
export function registerTroubleRetry(next: (() => void) | null): void {
  retryNow = next;
}

export function retryPlaybackNow(): void {
  retryNow?.();
}

export function readPlaybackTrouble(): PlaybackTroubleState {
  return current;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export function usePlaybackTroubleState(): PlaybackTroubleState {
  return useSyncExternalStore(subscribe, readPlaybackTrouble);
}

/**
 * La lecture vient de passer par le SERVEUR : le producteur de PrismCore est
 * mort deux fois au même endroit (`usePlaybackRecovery`). Hors de l'état de
 * la reprise, que l'ouverture du flux serveur remet à zéro : l'habillage le
 * dit quelques secondes après (`usePlaybackTrouble`).
 */
let serverFallbackAt: number | null = null;
const fallbackListeners = new Set<() => void>();

export function noteServerFallback(at: number | null): void {
  if (serverFallbackAt === at) return;
  serverFallbackAt = at;
  fallbackListeners.forEach((listener) => listener());
}

const subscribeFallback = (listener: () => void) => {
  fallbackListeners.add(listener);
  return () => { fallbackListeners.delete(listener); };
};
export function useServerFallbackAt(): number | null {
  return useSyncExternalStore(subscribeFallback, () => serverFallbackAt);
}
