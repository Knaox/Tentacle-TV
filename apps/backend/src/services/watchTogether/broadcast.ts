import { isUserOnline, sendToUser } from "../wsManager";
import type { Invite, Room } from "./roomTypes";
import type { WtDissolvedReason, WtInviteDto, WtRoomStateDto, WtStateCause } from "./protocol";

/** Watch Together — projection Room→DTO et diffusion aux membres. */

export function roomToDto(room: Room): WtRoomStateDto {
  const members = [...room.members.values()]
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((m) => ({
      userId: m.userId,
      username: m.username,
      hasAvatar: m.hasAvatar,
      online: isUserOnline(m.userId),
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
  };
}

/** Diffuse l'état complet de la room à tous ses membres. */
export function broadcastRoom(room: Room, cause: WtStateCause, originUserId: string | null): void {
  const msg = { type: "wt:state" as const, state: roomToDto(room), originUserId, cause };
  for (const userId of room.members.keys()) sendToUser(userId, msg);
}

/** État ciblé à un seul membre (réponse à wt:syncRequest). */
export function sendRoomState(userId: string, room: Room, cause: WtStateCause): void {
  sendToUser(userId, { type: "wt:state", state: roomToDto(room), originUserId: null, cause });
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
  sendToUser(invite.fromUserId, {
    type: "wt:inviteResult",
    inviteId: invite.inviteId,
    toUserId: invite.toUserId,
    toUsername,
    accepted,
  });
}

export function notifyDissolved(userId: string, groupId: string, reason: WtDissolvedReason): void {
  sendToUser(userId, { type: "wt:dissolved", groupId, reason });
}
