import { sendToUser } from "../wsManager";
import type { Invite, Room, RoomMember } from "./roomTypes";
import { isMemberOnline, sendToMember, sendToRoom } from "./memberDevices";
import { wtAllReady } from "./syncReadyGate";
import { notifyElsewhereRoom } from "./elsewhere";
import { getRoom } from "./roomRegistry";
import type { WtDissolvedReason, WtInviteDto, WtRoomStateDto, WtStateCause } from "./protocol";

/** Watch Together — projection Room→DTO et diffusion aux membres. */

export function roomToDto(room: Room): WtRoomStateDto {
  const members = [...room.members.values()]
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((m) => ({
      userId: m.userId,
      username: m.username,
      hasAvatar: m.hasAvatar,
      online: isMemberOnline(m),
      inPlayback: m.inPlayback,
      buffering: m.buffering,
      playbackError: m.playbackError,
      isHost: m.userId === room.hostUserId,
      joinedAt: m.joinedAt,
      // Clés FACULTATIVES : absentes tant qu'elles ne disent rien, pour qu'un
      // client d'avant ne voie jamais une valeur qu'il ne saurait pas lire.
      ...(m.protocolVersion > 1 ? { protocolVersion: m.protocolVersion } : {}),
      ...(m.rttMs !== null ? { rttMs: m.rttMs } : {}),
      ...(m.driftMs !== null ? { driftMs: m.driftMs } : {}),
    }));
  return {
    groupId: room.groupId,
    hostUserId: room.hostUserId,
    epoch: room.epoch,
    itemId: room.itemId,
    paused: room.paused,
    positionTicks: room.positionTicks,
    stateAtServerTime: room.stateAtServerTime,
    pauseReason: room.pauseReason,
    waitingForUserIds: [...room.waitingFor],
    members,
    // Recopie, jamais de lecture en base : `roomToDto` doit rester SYNCHRONE,
    // il est appelé depuis chaque diffusion. La clé n'apparaît QUE si la salle
    // les connaît — un client d'avant ne doit rien voir de nouveau.
    ...(room.hostSettings ? { hostPlaybackSettings: room.hostSettings } : {}),
    ...(room.barrier ? { barrierId: room.barrier.id } : {}),
    ...(room.waitCause ? { waitCause: room.waitCause } : {}),
    ...(room.pendingSkip ? { pendingSkip: { ...room.pendingSkip } } : {}),
    ...(room.seekToken ? { seekToken: room.seekToken } : {}),
    // « Tous prêts » : seulement quand un titre est lancé (sinon rien à sauter).
    ...(room.itemId ? { allReady: wtAllReady(room) } : {}),
  };
}

/** Diffuse l'état complet de la room à tous ses membres — à leurs appareils
 *  liés seulement (1.32.0) : un autre appareil du compte n'en voit rien. */
export function broadcastRoom(room: Room, cause: WtStateCause, originUserId: string | null): void {
  sendToRoom(room, { type: "wt:state", state: roomToDto(room), originUserId, cause });
  // Ce que voient les AUTRES appareils des membres : qui, quel titre, quel hôte.
  if (ELSEWHERE_CAUSES.has(cause)) notifyElsewhereRoom(room);
}

/** Les changements qui modifient l'avis « groupe en cours sur un autre appareil ». */
const ELSEWHERE_CAUSES: ReadonlySet<WtStateCause> = new Set(["join", "leave", "kick", "hostChange", "setItem"]);

/** État ciblé à un seul membre (réponse à wt:syncRequest). */
export function sendRoomState(userId: string, room: Room, cause: WtStateCause): void {
  const member = room.members.get(userId);
  if (member) sendToMember(member, { type: "wt:state", state: roomToDto(room), originUserId: null, cause });
}

export function inviteToDto(invite: Invite): WtInviteDto {
  return {
    inviteId: invite.inviteId,
    groupId: invite.groupId,
    fromUserId: invite.fromUserId,
    fromUsername: invite.fromUsername,
    itemId: invite.itemId,
    itemName: invite.itemName,
  };
}

export function notifyInvite(invite: Invite): void {
  sendToUser(invite.toUserId, { type: "wt:invite", invite: inviteToDto(invite) });
}

/** Notifie l'émetteur de l'invitation (l'hôte) du sort de celle-ci. */
export function notifyInviteResult(invite: Invite, toUsername: string, accepted: boolean): void {
  // À l'hôte, sur ses appareils liés à la salle (un autre appareil n'a rien à en dire).
  const host = getRoom(invite.groupId)?.members.get(invite.fromUserId);
  const send = (msg: Parameters<typeof sendToUser>[1]) => (host ? sendToMember(host, msg) : sendToUser(invite.fromUserId, msg));
  send({
    type: "wt:inviteResult",
    inviteId: invite.inviteId,
    toUserId: invite.toUserId,
    toUsername,
    accepted,
  });
}

/** Le membre ne fait plus partie de la salle : à SES appareils liés (le
 *  membre retiré garde la liste de ceux qu'il avait). */
export function notifyDissolved(member: RoomMember, groupId: string, reason: WtDissolvedReason): void {
  sendToMember(member, { type: "wt:dissolved", groupId, reason });
}
