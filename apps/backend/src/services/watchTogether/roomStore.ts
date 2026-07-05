import { randomUUID } from "node:crypto";
import { WT_GRACE_PERIOD_MS, type WtPauseReason } from "./protocol";

/**
 * Watch Together — état en mémoire des groupes (éphémères, aucune persistance).
 * Ce module est purement mécanique : pas d'I/O WebSocket, pas de logique de
 * lecture (voir sync.ts) ni de diffusion (voir broadcast.ts).
 *
 * Invariant central : un utilisateur appartient à AU PLUS un groupe
 * (`memberIndex`), et n'a qu'une invitation pendante par groupe.
 */

export interface RoomMember {
  userId: string;
  username: string;
  hasAvatar: boolean;
  inPlayback: boolean;
  buffering: boolean;
  playbackError: boolean;
  joinedAt: number;
  /** Timer de grâce armé quand le membre passe hors ligne (F5, coupure). */
  graceTimer: ReturnType<typeof setTimeout> | null;
}

export interface Room {
  groupId: string;
  epoch: number;
  hostUserId: string;
  /** Média « contexte » (fiche média au moment du create) — affichage/invites. */
  contextItemId: string | null;
  /** Média en cours de lecture synchronisée (null = rien lancé). */
  itemId: string | null;
  paused: boolean;
  positionTicks: number;
  stateAtServerTime: number;
  pauseReason: WtPauseReason;
  /** Membres dont on attend la fin de mise en mémoire tampon (group-wait). */
  waitingFor: Set<string>;
  /** Horodatage d'entrée dans waitingFor (miroir) — timeout anti-gel infini. */
  waitingSince: Map<string, number>;
  members: Map<string, RoomMember>;
  /** Anti-spam seek : dernier seek accepté par membre. */
  lastSeekAt: Map<string, number>;
  createdAt: number;
}

export interface Invite {
  inviteId: string;
  groupId: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  /** Snapshot du média du groupe au moment de l'invitation (contexte UI). */
  itemId: string | null;
  itemName: string | null;
  createdAt: number;
}

export interface UserBasic {
  userId: string;
  username: string;
  hasAvatar: boolean;
}

const rooms = new Map<string, Room>();
/** userId → groupId (un seul groupe par utilisateur). */
const memberIndex = new Map<string, string>();
const invites = new Map<string, Invite>();

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
  };
}

// ── Rooms ──

export function getRoom(groupId: string): Room | null {
  return rooms.get(groupId) ?? null;
}

/** Itérateur des rooms actives (sweeps périodiques du gateway). */
export function allRooms(): IterableIterator<Room> {
  return rooms.values();
}

export function getRoomOf(userId: string): Room | null {
  const groupId = memberIndex.get(userId);
  return groupId ? (rooms.get(groupId) ?? null) : null;
}

/** Crée un groupe avec `user` comme hôte. Renvoie null si déjà en groupe. */
export function createRoom(user: UserBasic, contextItemId: string | null): Room | null {
  if (memberIndex.has(user.userId)) return null;
  const now = Date.now();
  const room: Room = {
    groupId: randomUUID(),
    epoch: 0,
    hostUserId: user.userId,
    contextItemId,
    itemId: null,
    paused: true,
    positionTicks: 0,
    stateAtServerTime: now,
    pauseReason: "user",
    waitingFor: new Set(),
    waitingSince: new Map(),
    members: new Map([[user.userId, newMember(user, now)]]),
    lastSeekAt: new Map(),
    createdAt: now,
  };
  rooms.set(room.groupId, room);
  memberIndex.set(user.userId, room.groupId);
  return room;
}

/** Ajoute un membre (idempotent). Renvoie null si le user est dans un AUTRE groupe. */
export function addMember(room: Room, user: UserBasic): RoomMember | null {
  const existing = room.members.get(user.userId);
  if (existing) return existing;
  const current = memberIndex.get(user.userId);
  if (current && current !== room.groupId) return null;
  const member = newMember(user, Date.now());
  room.members.set(user.userId, member);
  memberIndex.set(user.userId, room.groupId);
  return member;
}

export interface RemovalResult {
  room: Room;
  removed: RoomMember;
  /** Nouvel hôte élu (plus ancien joinedAt) si l'hôte est parti, sinon null. */
  newHostId: string | null;
  /** Le groupe est vide et a été détruit. */
  dissolved: boolean;
}

/** Retire un membre ; transfert d'hôte au plus ancien ; GC si vide. */
export function removeMember(userId: string): RemovalResult | null {
  const room = getRoomOf(userId);
  if (!room) return null;
  const removed = room.members.get(userId)!;
  cancelGrace(userId);
  room.members.delete(userId);
  room.waitingFor.delete(userId);
  room.waitingSince.delete(userId);
  room.lastSeekAt.delete(userId);
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

// ── Invitations ──

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
