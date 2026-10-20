import { WT_GROUP_WAIT_TIMEOUT_MS } from "./protocol";
import { removeMember } from "./roomStore";
import type { RemovalResult, Room, RoomMember } from "./roomTypes";
import { touch } from "./syncSchedule";
import { cancelResumeOnRelease, dropBarrier, pruneWaiting } from "./syncBarrier";
import { anyoneWatching } from "./syncGuards";
import { resetSkips } from "./syncSkip";
import { dropReadyGate } from "./syncReadyGate";
import { arrivalHeldElsewhere, dropArrival, isArrivingDevice } from "./arrivalState";

/**
 * Watch Together — ce qui retire un lecteur de la salle : le balayage
 * anti-gel, la fermeture du socket d'un lecteur, le départ d'un membre. Sorti
 * de `sync.ts` (plafond des 300 lignes) ; `sync.ts` le réexporte.
 */

/** Anti-gel infini : les membres attendus depuis plus de WT_GROUP_WAIT_TIMEOUT_MS
 *  sont déclarés en échec de lecture et le groupe reprend sans eux. Appelé par
 *  le sweep périodique du gateway. Si plus PERSONNE ne regarde, la salle ne
 *  repart pas : elle reste en pause — sinon son horloge tournait seule, au-delà
 *  de la fin du titre, et les lecteurs s'y recalaient au réveil (défaut M4 du
 *  banc : de 48 s à 1 069 s sur un épisode de 300 s, deux « épisode suivant »). */
export function expireStaleWaits(room: Room, now: number): { expired: string[]; resumed: boolean } {
  const expired: string[] = [];
  for (const [userId, since] of room.waitingSince) {
    if (now - since >= WT_GROUP_WAIT_TIMEOUT_MS) expired.push(userId);
  }
  if (expired.length === 0) return { expired, resumed: false };
  let resumed = false;
  for (const userId of expired) {
    const member = room.members.get(userId);
    if (member) {
      member.playbackError = true; // toast « X ne peut pas lire » côté clients
      member.buffering = false;
      member.inPlayback = false;
    }
    // Un arrivant resté en route : l'échec le dit, il n'arrive plus.
    dropArrival(room, userId);
  }
  if (!anyoneWatching(room)) {
    cancelResumeOnRelease(room);
    room.pauseReason = "user";
  }
  for (const userId of expired) resumed = pruneWaiting(room, userId, now) || resumed;
  if (!resumed) touch(room, now);
  return { expired, resumed };
}

/** Le socket d'un lecteur en séance s'est fermé : son attente est levée (il ne
 *  peut plus rien confirmer) ; il se redéclarera à sa reconnexion. `deviceKey` :
 *  l'appareil de ce socket — s'il n'est pas celui qui arrive pour ce compte,
 *  l'attente de l'arrivant reste. */
export function releaseMemberWait(room: Room, member: RoomMember, deviceKey?: string): boolean {
  member.inPlayback = false;
  member.buffering = false;
  member.playbackSocket = null;
  const now = Date.now();
  if (arrivalHeldElsewhere(room, member.userId, deviceKey)) {
    touch(room, now);
    return false;
  }
  if (isArrivingDevice(room, member.userId, deviceKey)) dropArrival(room, member.userId);
  const resumed = pruneWaiting(room, member.userId, now);
  if (!resumed) touch(room, now);
  return resumed;
}

export interface MemberRemoval extends RemovalResult {
  /** La lecture a repris (le membre retiré était le dernier attendu du group-wait). */
  resumed: boolean;
}

/** Retire un membre (leave/kick/grâce expirée) et répare le group-wait. */
export function removeMemberAndSync(userId: string): MemberRemoval | null {
  const result = removeMember(userId);
  if (!result) return null;
  const now = Date.now();
  let resumed = false;
  if (result.dissolved) {
    resetSkips(result.room);
    dropBarrier(result.room);
    dropReadyGate(result.room);
  } else {
    resumed = pruneWaiting(result.room, userId, now);
    if (!resumed) touch(result.room, now);
  }
  return { ...result, resumed };
}
