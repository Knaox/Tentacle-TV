import { randomUUID } from "node:crypto";
import { invites, rooms } from "./roomRegistry";
import type { Invite, Room } from "./roomTypes";

/** Watch Together — invitations (dédupliquées par groupe + destinataire). */

/** Crée une invitation (dédupliquée par groupe+destinataire). */
export function createInvite(
  room: Room,
  from: { userId: string; username: string },
  toUserId: string,
  itemId: string | null,
  itemName: string | null,
): Invite {
  for (const inv of invites.values()) {
    if (inv.groupId === room.groupId && inv.toUserId === toUserId) return inv;
  }
  const invite: Invite = {
    inviteId: randomUUID(),
    groupId: room.groupId,
    fromUserId: from.userId,
    fromUsername: from.username,
    toUserId,
    itemId,
    itemName,
    createdAt: Date.now(),
  };
  invites.set(invite.inviteId, invite);
  return invite;
}

/** Consomme une invitation (retire et renvoie) si elle appartient bien à `toUserId`. */
export function takeInvite(inviteId: string, toUserId: string): Invite | null {
  const inv = invites.get(inviteId);
  if (!inv || inv.toUserId !== toUserId) return null;
  invites.delete(inviteId);
  return inv;
}

export function invitesFor(userId: string): Invite[] {
  const list: Invite[] = [];
  for (const inv of invites.values()) {
    if (inv.toUserId === userId && rooms.has(inv.groupId)) list.push(inv);
  }
  return list;
}

export function deleteInvitesForGroup(groupId: string): void {
  for (const [id, inv] of invites) {
    if (inv.groupId === groupId) invites.delete(id);
  }
}
