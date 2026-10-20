import { WT_PROTOCOL_VERSION } from "./protocol";
import type { Room, RoomMember } from "./roomTypes";
import { isMemberOnline } from "./memberDevices";

/**
 * Watch Together — deux gardes de la synchronisation, sorties de `sync.ts`
 * (plafond des 300 lignes) : qui regarde encore, et quand un « prêt » n'est
 * qu'une fin de chargement.
 */

/** Au moins un membre en ligne regarde encore (en lecture, sans échec). */
export function anyoneWatching(room: Room): boolean {
  for (const m of room.members.values()) {
    if (m.inPlayback && !m.playbackError && isMemberOnline(m)) return true;
  }
  return false;
}

/** Fin de chargement (sans identifiant de barrière) d'un lecteur v2 qu'une
 *  barrière de seek ou de saut attend : ce n'est pas un « posé sur la cible ». */
export function loadedDuringSeekBarrier(room: Room, member: RoomMember, barrierId: number | undefined): boolean {
  return barrierId === undefined && member.protocolVersion >= WT_PROTOCOL_VERSION
    && room.barrier !== null && room.barrier.cause !== "buffering" && room.waitingFor.has(member.userId);
}

