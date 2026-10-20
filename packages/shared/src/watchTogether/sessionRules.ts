import { parseWtSeekToken, wtPositionSecondsAt, type WtRoomStateDto, type WtSeekToken } from "../types/watchTogether";

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
 * La salle, en pause, m'attend encore (chargement, arrivée, barrière) : un
 * lecteur qui devient prêt à cet instant reste en pause jusqu'à la reprise
 * planifiée. Sinon il jouait seul le temps que la reprise arrive — 0,2 à
 * 0,8 s sur mpv au banc du 20/10, puis un recalage visible.
 */
export function isRoomWaitingForMe(room: WtRoomStateDto | null | undefined, selfId: string | null): boolean {
  return !!room && !!selfId && room.paused && room.waitingForUserIds.includes(selfId);
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

/**
 * L'état de la salle est-il l'écho d'un de MES seeks plus anciens que le
 * dernier que j'ai demandé ? Alors je ne m'y recale pas : mon seek suivant
 * arrive, et c'est lui qui posera la salle (sauts rapides, B7 — sans cela,
 * chaque écho me ramenait en arrière et l'appui suivant repartait de là).
 * `latest` : mon dernier seek, null s'il est trop ancien pour qu'on l'attende.
 */
export function isOwnOlderSeekEcho(roomToken: string | undefined, latest: WtSeekToken | null): boolean {
  const echoed = parseWtSeekToken(roomToken);
  return !!echoed && !!latest && echoed.device === latest.device && echoed.seq < latest.seq;
}

/**
 * La position où ouvrir le lecteur d'un membre qui REJOINT le titre de la
 * salle. Gelée (pause, attente — la salle se gèle AU CLIC « Rejoindre » depuis
 * le serveur du 20/10) : sa position exacte. En lecture (serveur d'avant,
 * lecteur rouvert) : là où la salle sera quand le serveur recevra ma
 * déclaration, un aller simple plus tard — c'est là qu'il la gèle pour
 * m'attendre ; partir de « maintenant » m'ouvrait derrière la pause.
 */
export function wtJoinStartSeconds(
  room: Pick<WtRoomStateDto, "paused" | "positionTicks" | "stateAtServerTime">,
  serverNow: number,
  rttMs: number | null,
): number {
  const oneWayMs = room.paused ? 0 : Math.max(0, rttMs ?? 0) / 2;
  return Math.max(0, wtPositionSecondsAt(room, serverNow + oneWayMs));
}

/**
 * La position à joindre à « je charge » (`wt:buffering true`) : celle où
 * geler la salle. Un rechargement dit celle qu'il VISE (`freezeAtS`) ; un
 * lecteur qui cale en pleine lecture, la sienne. Un lecteur qui n'a encore
 * rien lu (premier chargement, reconnexion en plein chargement) n'en dit
 * AUCUNE : la salle se gèle sur la sienne — sa position de départ, ou 0, la
 * ramenait en arrière (retour de Damien du 20/10).
 */
export function wtBufferingFreezeSeconds(opts: { freezeAtS?: number; playerS: number; wasReady: boolean }): number | undefined {
  if (opts.freezeAtS !== undefined) return opts.freezeAtS;
  return opts.wasReady ? opts.playerS : undefined;
}
