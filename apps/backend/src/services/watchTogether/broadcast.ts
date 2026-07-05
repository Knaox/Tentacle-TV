import { isUserOnline, sendToUser } from "../wsManager";
import type { Invite, Room } from "./roomStore";
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
