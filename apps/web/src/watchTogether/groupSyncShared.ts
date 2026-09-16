import type { MutableRefObject } from "react";
import {
  TICKS_PER_SECOND, WT_SEEK_LATENCY_MAX_S, WT_SEEK_LATENCY_MIN_S, WT_SEEK_LOOKAHEAD_S,
  type WsClientMessage, type WtRoomStateDto,
} from "@tentacle-tv/shared";
import type { PlayerTransport } from "./playerTransport";
import { getClockRttMs } from "@tentacle-tv/api-client";
import { pendingIntentUntil, type PendingIntent, type PendingIntentKind } from "./groupSchedule";

/**
 * Watch Together — état et helpers partagés entre le moteur de sync
 * (useGroupSyncEngine : application d'états, intents) et la boucle de drift
 * (useGroupDriftLoop). Les refs sont créées par le moteur et passées en bundle
 * stable ; aucune logique React ici.
 */

/** Fenêtre pendant laquelle les événements player locaux sont considérés comme
 *  l'écho d'une commande distante que le moteur vient d'appliquer. */
export const APPLY_ECHO_WINDOW_MS = 400;
/** Saut de position entre deux états serveur interprété comme un seek distant. */
export const REMOTE_JUMP_THRESHOLD_S = 1;

/** Group-wait dont JE suis la cause (mon player charge/bufferise/far-seek).
 *  Ni pause, ni seek, ni correction de drift ne doivent m'être appliqués dans
 *  cet état : mpv pausé ou seeké en plein démarrage HLS coince le demuxer
 *  (écran noir, plus jamais de playback-restart). */
export function isWaitedForMe(room: WtRoomStateDto | null | undefined, selfId: string | null): boolean {
  return !!room && !!selfId && room.paused && room.pauseReason === "buffering"
    && room.waitingForUserIds.includes(selfId);
}

/** Un play() programmé pour l'instant de reprise de la salle. */
export interface ScheduledPlay {
  /** Epoch de l'état qui l'a programmé — un autre epoch l'annule. */
  epoch: number;
  timer: ReturnType<typeof setTimeout> | null;
  /** performance.now() de l'appel play(), null tant qu'il n'est pas parti —
   *  la latence de démarrage se mesure d'ici à l'événement de lecture. */
  playCalledAt: number | null;
  /** Date.now() au-delà duquel on cesse d'attendre que le lecteur se déclare
   *  en lecture (la boucle de dérive reprend alors la main). */
  until: number;
}

/** La salle attend que JE sois posé sur une cible (barrière v2) : à moi de
 *  me caler et de confirmer — quelle que soit la raison de pause. */
export function isBarrierParticipant(room: WtRoomStateDto | null | undefined, selfId: string | null): boolean {
  return !!room && !!selfId && room.barrierId !== undefined && room.waitingForUserIds.includes(selfId);
}

/** Confirme au serveur que ce lecteur est posé sur la cible de la barrière. */
export function sendBarrierReady(shared: GroupSyncSharedRefs, transport: PlayerTransport, barrierId: number): void {
  const positionTicks = Math.max(0, Math.round(transport.getPositionSeconds() * TICKS_PER_SECOND));
  shared.sendRef.current({
    type: "wt:buffering", buffering: false, barrierId, positionTicks, rttMs: getClockRttMs() ?? undefined,
  });
}

/** Refs partagées moteur ↔ boucle de drift (identités stables). */
export interface GroupSyncSharedRefs {
  roomRef: MutableRefObject<WtRoomStateDto | null>;
  serverNowRef: MutableRefObject<() => number>;
  selfIdRef: MutableRefObject<string | null>;
  sendRef: MutableRefObject<(msg: WsClientMessage) => boolean>;
  /** Timestamp jusqu'auquel les événements player locaux sont des échos. */
  applyingUntilRef: MutableRefObject<number>;
  /** Dernier wt:buffering émis (null = player jamais prêt depuis le montage —
   *  la boucle de drift reste inerte tant que ce n'est pas `false`). */
  lastBufferingSentRef: MutableRefObject<boolean | null>;
  softCorrectionSinceRef: MutableRefObject<number | null>;
  currentRateRef: MutableRefObject<number>;
  /** Intent envoyé dont l'écho serveur n'est pas revenu : la boucle de dérive
   *  ne réconcilie ni ne seeke contre lui (sinon elle relance la lecture entre
   *  la pause locale et son écho, ou ramène l'auteur d'un seek en arrière). */
  pendingIntentRef: MutableRefObject<PendingIntent | null>;
  /** play() programmé pour une reprise planifiée. */
  scheduledPlayRef: MutableRefObject<ScheduledPlay | null>;
  /** Latence de démarrage mesurée de ce lecteur (ms), null tant qu'inconnue. */
  playLatencyMsRef: MutableRefObject<number | null>;
  /** Latence de seek mesurée (secondes, lissée), null tant qu'inconnue — le
   *  lookahead d'un seek dur en lecture. */
  seekLatencySRef: MutableRefObject<number | null>;
  /** Seek dur en vol, pour mesurer sa latence à l'atterrissage. */
  pendingHardSeekRef: MutableRefObject<{ at: number; targetS: number } | null>;
}

/** Lookahead d'un seek dur en lecture : la latence mesurée, sinon le repli. */
export function seekLookaheadS(shared: GroupSyncSharedRefs): number {
  return shared.seekLatencySRef.current ?? WT_SEEK_LOOKAHEAD_S;
}

/** Latence de seek lissée (moyenne mobile exponentielle, 0,3), bornée. */
export function updateSeekLatency(previous: number | null, measuredS: number): number {
  const clamped = Math.min(WT_SEEK_LATENCY_MAX_S, Math.max(WT_SEEK_LATENCY_MIN_S, measuredS));
  return previous === null ? clamped : previous * 0.7 + clamped * 0.3;
}

export function setPendingIntent(shared: GroupSyncSharedRefs, kind: PendingIntentKind, rttMs: number | null): void {
  shared.pendingIntentRef.current = { kind, until: pendingIntentUntil(Date.now(), rttMs) };
}

export function clearPendingIntent(shared: GroupSyncSharedRefs): void {
  shared.pendingIntentRef.current = null;
}

/** Un intent est-il encore en vol ? (un intent expiré est oublié au passage) */
export function hasPendingIntent(shared: GroupSyncSharedRefs, now: number = Date.now()): boolean {
  const pending = shared.pendingIntentRef.current;
  if (!pending) return false;
  if (pending.until <= now) { shared.pendingIntentRef.current = null; return false; }
  return true;
}

export function cancelScheduledPlay(shared: GroupSyncSharedRefs): void {
  const scheduled = shared.scheduledPlayRef.current;
  if (scheduled?.timer) clearTimeout(scheduled.timer);
  shared.scheduledPlayRef.current = null;
}

/** Une reprise planifiée attend encore que le lecteur se déclare en lecture. */
export function isAwaitingScheduledPlay(shared: GroupSyncSharedRefs, now: number = Date.now()): boolean {
  const scheduled = shared.scheduledPlayRef.current;
  if (!scheduled) return false;
  if (scheduled.until <= now) { cancelScheduledPlay(shared); return false; }
  return true;
}

export function armEcho(shared: GroupSyncSharedRefs): void {
  shared.applyingUntilRef.current = Date.now() + APPLY_ECHO_WINDOW_MS;
}

export function isApplying(shared: GroupSyncSharedRefs): boolean {
  return Date.now() < shared.applyingUntilRef.current;
}

/** Change la vitesse du player (dédupliqué — no-op si déjà à `rate`). */
export function setTransportRate(
  shared: GroupSyncSharedRefs,
  transport: PlayerTransport | null,
  rate: number,
): void {
  if (shared.currentRateRef.current === rate) return;
  shared.currentRateRef.current = rate;
  transport?.setRate(rate);
}

/**
 * Une séance est active sur CE média quand une salle existe VRAIMENT.
 *
 * Le drapeau `isInGroup` ne suffit pas : le shim webOS le pose à vrai sans
 * salle, pour masquer le bouton d'invitation et le menu de vitesse — le
 * téléviseur n'a pas de Watch Together. Le lecteur, lui, en déduisait une
 * séance : plus de décompte de saut, plus d'indicateur de reprise, et des
 * messages `wt:*` envoyés dans le vide.
 */
export function isGroupSessionActive(
  isInGroup: boolean,
  room: WtRoomStateDto | null | undefined,
  itemId: string | undefined,
): boolean {
  return isInGroup && !!room && !!itemId;
}
