import { sendToUser } from "../../wsManager";
import type { WtAffinityCause, WtAffinityStateDto, WtServerMessage } from "../protocol";
import { createRoomQueue } from "../roomQueue";
import type { Room } from "../roomTypes";
import { keysSeenByAll, sharedState } from "./affinityRights";
import { matchToDto, sessionToDto } from "./affinitySession";
import { bumpAffinitySeq, currentAffinitySeq, getAffinity } from "./affinityRegistry";
import type { AffinityMatch } from "./affinityTypes";

/**
 * Affinité — l'état diffusé à TOUTE la salle, participants ou non : la
 * séance s'ouvre chez tous, et qui ne swipe pas apprend qu'elle tourne.
 *
 * Une proposition ne part que si TOUS les membres voient son titre
 * (`affinityRights.ts`) : l'état est le même pour chacun, au socket comme en
 * REST. Juger demande Jellyfin : la diffusion attend ses verdicts dans une
 * file propre à la salle, et les états partent dans l'ordre de leur `seq`.
 * Sans proposition ni match à juger, elle part tout de suite, comme avant.
 */

const inBroadcastOrder = createRoomQueue();

/** L'état courant, sans diffusion (lecture REST), jugé comme une diffusion. */
export async function affinityStateOf(room: Room): Promise<WtAffinityStateDto | null> {
  const session = getAffinity(room);
  if (!session) return null;
  const state = sessionToDto(session, currentAffinitySeq(room));
  if (state.proposals.length === 0) return state;
  return sharedState(state, await keysSeenByAll([...room.members.keys()], state.proposals));
}

export function broadcastAffinity(
  room: Room,
  cause: WtAffinityCause,
  originUserId: string | null,
  extra: { matchKeys?: readonly string[]; match?: AffinityMatch | null } = {},
): void {
  // L'instantané est pris MAINTENANT (état, `seq`, destinataires) ; seul le jugement attend.
  const session = getAffinity(room);
  const state = session ? sessionToDto(session, bumpAffinitySeq(room)) : null;
  const match = extra.match ? matchToDto(extra.match) : null;
  const matchKeys = extra.matchKeys ?? [];
  const recipients = [...room.members.keys()];
  const judged = [...(state?.proposals ?? []), ...(match ? [match] : [])];

  const send = (seen: ReadonlySet<string>) => {
    const fresh = matchKeys.filter((key) => seen.has(key));
    const message: WtServerMessage = {
      type: "wt:affinity",
      state: state ? sharedState(state, seen) : null,
      cause,
      originUserId,
      ...(fresh.length > 0 ? { matchKeys: fresh } : {}),
      ...(match && seen.has(match.key) ? { match } : {}),
    };
    for (const userId of recipients) sendToUser(userId, message);
  };
  if (judged.length === 0) inBroadcastOrder(room, () => send(new Set()));
  else inBroadcastOrder(room, async () => send(await keysSeenByAll(recipients, judged)), true);
}
