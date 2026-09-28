import { sendToUser } from "../../wsManager";
import type { WtAffinityCause, WtAffinityStateDto, WtServerMessage } from "../protocol";
import type { Room } from "../roomTypes";
import { matchToDto, sessionToDto } from "./affinitySession";
import { bumpAffinitySeq, currentAffinitySeq, getAffinity } from "./affinityRegistry";
import type { AffinityMatch } from "./affinityTypes";

/**
 * Affinité — l'état diffusé à TOUTE la salle, participants ou non : la
 * séance s'ouvre chez tous, et qui ne swipe pas apprend qu'elle tourne.
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
  extra: { matchKeys?: readonly string[]; match?: AffinityMatch | null } = {},
): void {
  const session = getAffinity(room);
  const matchKeys = extra.matchKeys ?? [];
  const message: WtServerMessage = {
    type: "wt:affinity",
    state: session ? sessionToDto(session, bumpAffinitySeq(room)) : null,
    cause,
    originUserId,
    ...(matchKeys.length > 0 ? { matchKeys: [...matchKeys] } : {}),
    ...(extra.match ? { match: matchToDto(extra.match) } : {}),
  };
  for (const userId of room.members.keys()) sendToUser(userId, message);
}
