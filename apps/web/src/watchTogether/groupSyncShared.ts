import type { MutableRefObject } from "react";
import type { WtRoomStateDto } from "@tentacle-tv/shared";
import type { PlayerTransport } from "./playerTransport";

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

/** Refs partagées moteur ↔ boucle de drift (identités stables). */
export interface GroupSyncSharedRefs {
  roomRef: MutableRefObject<WtRoomStateDto | null>;
  serverNowRef: MutableRefObject<() => number>;
  selfIdRef: MutableRefObject<string | null>;
  /** Timestamp jusqu'auquel les événements player locaux sont des échos. */
  applyingUntilRef: MutableRefObject<number>;
  /** Dernier wt:buffering émis (null = player jamais prêt depuis le montage —
   *  la boucle de drift reste inerte tant que ce n'est pas `false`). */
  lastBufferingSentRef: MutableRefObject<boolean | null>;
  softCorrectionSinceRef: MutableRefObject<number | null>;
  currentRateRef: MutableRefObject<number>;
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
