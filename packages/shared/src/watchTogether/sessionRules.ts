import type { WtRoomStateDto } from "../types/watchTogether";

/**
 * Watch Together — ce qu'un lecteur conclut de l'état de la salle, sans
 * React ni plateforme : lu par le moteur de synchronisation (api-client) de
 * chaque lecteur — web, bureau, mobile.
 */

/** Group-wait dont JE suis la cause (mon lecteur charge, bufferise, far-seek).
 *  Ni pause, ni seek, ni correction de dérive ne doivent m'être appliqués dans
 *  cet état : mpv pausé ou seeké en plein démarrage HLS coince le démuxeur
 *  (écran noir, plus jamais de playback-restart). */
export function isWaitedForMe(room: WtRoomStateDto | null | undefined, selfId: string | null): boolean {
  return !!room && !!selfId && room.paused && room.pauseReason === "buffering"
    && room.waitingForUserIds.includes(selfId);
}

/** La salle attend que JE sois posé sur une cible (barrière v2) : à moi de
 *  me caler et de confirmer — quelle que soit la raison de pause. */
export function isBarrierParticipant(room: WtRoomStateDto | null | undefined, selfId: string | null): boolean {
  return !!room && !!selfId && room.barrierId !== undefined && room.waitingForUserIds.includes(selfId);
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
