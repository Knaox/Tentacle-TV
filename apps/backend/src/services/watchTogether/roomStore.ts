import { randomUUID } from "node:crypto";
import { WT_GRACE_PERIOD_MS } from "./protocol";
import { memberIndex, getRoomOf, rooms } from "./roomRegistry";
import { deleteInvitesForGroup } from "./roomInvites";
import type { RemovalResult, Room, RoomMember, UserBasic } from "./roomTypes";
import { bindDevice, clearDeviceGraces } from "./memberDevices";
import { dropArrival } from "./arrivalState";

/**
 * Watch Together — composition des groupes : création, adhésion, retrait,
 * grâce de déconnexion. Purement mécanique : pas d'I/O WebSocket, pas de
 * logique de lecture (voir sync.ts) ni de diffusion (voir broadcast.ts). Les
 * maps vivent dans `roomRegistry.ts`, les invitations dans `roomInvites.ts`.
 */

function newMember(user: UserBasic, now: number): RoomMember {
  return {
    userId: user.userId,
    username: user.username,
    hasAvatar: user.hasAvatar,
    inPlayback: false,
    buffering: false,
    playbackError: false,
    joinedAt: now,
    graceTimer: null,
    protocolVersion: 1,
    rttMs: null,
    driftMs: null,
    playbackSocket: null,
    devices: new Map(),
  };
}

// ── Rooms ──

/** Crée un groupe avec `user` comme hôte. Renvoie null si déjà en groupe.
 *  `deviceKey` : l'appareil qui crée — le seul lié au départ (1.31.1). */
export function createRoom(user: UserBasic, contextItemId: string | null, deviceKey?: string): Room | null {
  if (memberIndex.has(user.userId)) return null;
  const now = Date.now();
  const room: Room = {
    groupId: randomUUID(),
    epoch: 0,
    hostUserId: user.userId,
    hostSettings: null,
    contextItemId,
    itemId: null,
    paused: true,
    positionTicks: 0,
    stateAtServerTime: now,
    pauseReason: "user",
    waitingFor: new Set(),
    waitingSince: new Map(),
    barrierId: 0,
    barrier: null,
    waitCause: null,
    pendingSkip: null,
    skipHistory: new Map(),
    readyGate: null,
    arrivals: new Map(),
    seekToken: null,
    skipTimer: null,
    lastTickBroadcastAt: 0,
    members: new Map([[user.userId, newMember(user, now)]]),
    lastSeekAt: new Map(),
    chat: [],
    chatSeq: 0,
    chatRate: new Map(),
    typing: new Map(),
    createdAt: now,
  };
  if (deviceKey) bindDevice(room.members.get(user.userId)!, deviceKey, now);
  rooms.set(room.groupId, room);
  memberIndex.set(user.userId, room.groupId);
  return room;
}

/** Ajoute un membre (idempotent). Renvoie null si le user est dans un AUTRE groupe.
 *  `deviceKey` : l'appareil qui entre — lié à la salle, à côté des autres
 *  appareils déjà liés du compte s'il y était déjà. */
export function addMember(room: Room, user: UserBasic, deviceKey?: string): RoomMember | null {
  const existing = room.members.get(user.userId);
  if (existing) {
    if (deviceKey) bindDevice(existing, deviceKey);
    return existing;
  }
  const current = memberIndex.get(user.userId);
  if (current && current !== room.groupId) return null;
  const member = newMember(user, Date.now());
  if (deviceKey) bindDevice(member, deviceKey);
  room.members.set(user.userId, member);
  memberIndex.set(user.userId, room.groupId);
  return member;
}

// ── Départs ──

type MemberRemovedListener = (result: RemovalResult) => void;
const memberRemovedListeners = new Set<MemberRemovedListener>();

/**
 * Prévenir d'un départ, quelle qu'en soit la voie (quitter, expulsion, grâce
 * expirée, invitation acceptée ailleurs) : l'affinité s'y branche, les votes
 * du partant partent avec lui. Rend de quoi se débrancher.
 */
export function onMemberRemoved(listener: MemberRemovedListener): () => void {
  memberRemovedListeners.add(listener);
  return () => {
    memberRemovedListeners.delete(listener);
  };
}

/** Retire un membre ; transfert d'hôte au plus ancien ; GC si vide. */
export function removeMember(userId: string): RemovalResult | null {
  const result = detachMember(userId);
  if (result) for (const listener of memberRemovedListeners) listener(result);
  return result;
}

function detachMember(userId: string): RemovalResult | null {
  const room = getRoomOf(userId);
  if (!room) return null;
  const removed = room.members.get(userId)!;
  cancelGrace(userId);
  clearDeviceGraces(removed);
  removed.playbackSocket = null;
  room.members.delete(userId);
  room.waitingFor.delete(userId);
  room.waitingSince.delete(userId);
  room.lastSeekAt.delete(userId);
  dropArrival(room, userId);
  for (const key of room.chatRate.keys()) if (key.startsWith(`${userId}:`)) room.chatRate.delete(key);
  const typingTimer = room.typing.get(userId);
  if (typingTimer) clearTimeout(typingTimer);
  room.typing.delete(userId);
  memberIndex.delete(userId);

  if (room.members.size === 0) {
    rooms.delete(room.groupId);
    deleteInvitesForGroup(room.groupId);
    return { room, removed, newHostId: null, dissolved: true };
  }

  let newHostId: string | null = null;
  if (room.hostUserId === userId) {
    let oldest: RoomMember | null = null;
    for (const m of room.members.values()) {
      if (!oldest || m.joinedAt < oldest.joinedAt) oldest = m;
    }
    room.hostUserId = oldest!.userId;
    newHostId = oldest!.userId;
  }
  return { room, removed, newHostId, dissolved: false };
}

// ── Grâce de déconnexion ──

/** Arme la grâce d'un membre hors ligne ; `onExpired` déclenche le leave
 *  implicite. `graceMs` : grâce courte pour un départ annoncé (wt:goodbye) —
 *  remplace un éventuel timer plus long déjà armé. */
export function armGrace(
  userId: string,
  onExpired: (userId: string) => void,
  graceMs: number = WT_GRACE_PERIOD_MS,
): void {
  const room = getRoomOf(userId);
  const member = room?.members.get(userId);
  if (!member) return;
  if (member.graceTimer) {
    if (graceMs >= WT_GRACE_PERIOD_MS) return; // un timer court prime
    clearTimeout(member.graceTimer);
  }
  member.graceTimer = setTimeout(() => {
    member.graceTimer = null;
    onExpired(userId);
  }, graceMs);
}

export function cancelGrace(userId: string): void {
  const member = getRoomOf(userId)?.members.get(userId);
  if (member?.graceTimer) {
    clearTimeout(member.graceTimer);
    member.graceTimer = null;
  }
}
