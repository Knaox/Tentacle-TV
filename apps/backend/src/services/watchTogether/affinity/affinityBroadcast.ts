import { sendToUser } from "../../wsManager";
import type { WtAffinityCause, WtAffinityStateDto, WtServerMessage } from "../protocol";
import type { Room } from "../roomTypes";
import { sessionToDto } from "./affinitySession";
import { bumpAffinitySeq, currentAffinitySeq, getAffinity } from "./affinityRegistry";

/**
 * Affinité — l'état diffusé à TOUTE la salle, participants ou non : un match
 * dit au groupe ce qu'il pourrait regarder, même à qui n'a pas swipé.
 */

/** L'état courant, sans diffusion (lecture REST). */
export function affinityStateOf(room: Room): WtAffinityStateDto | null {
  const session = getAffinity(room);
  return session ? sessionToDto(session, currentAffinitySeq(room)) : null;
}

export function broadcastAffinity(
  room: Room,
  cause: WtAffinityCause,
  originUserId: string | null,
  matchKeys: readonly string[] = [],
): void {
  const session = getAffinity(room);
  const message: WtServerMessage = {
    type: "wt:affinity",
    state: session ? sessionToDto(session, bumpAffinitySeq(room)) : null,
    cause,
    originUserId,
    ...(matchKeys.length > 0 ? { matchKeys: [...matchKeys] } : {}),
  };
  for (const userId of room.members.keys()) sendToUser(userId, message);
}
