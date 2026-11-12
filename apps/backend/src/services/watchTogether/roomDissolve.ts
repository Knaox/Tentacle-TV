import { notifyDissolved } from "./broadcast";
import { notifyElsewhere } from "./elsewhere";
import { isMemberOnline } from "./memberDevices";
import type { Room } from "./roomTypes";
import { removeMemberAndSync } from "./sync";

/**
 * Watch Together — ce que l'ADMINISTRATION fait d'une salle entière (tableau de bord des
 * sessions, `sessions.groupChat`), à côté des départs qu'un membre décide lui-même.
 */

/** Personne n'est dans son lecteur : la salle existe, mais rien ne s'y lit. */
export function isRoomIdle(room: Room): boolean {
  for (const member of room.members.values()) if (member.inPlayback) return false;
  return true;
}

/** Les membres qui ont au moins un appareil lié en ligne — ceux qu'un message atteint maintenant. */
export function onlineMemberCount(room: Room): number {
  let count = 0;
  for (const member of room.members.values()) if (isMemberOnline(member)) count += 1;
  return count;
}

/**
 * Ferme la salle : chaque membre en sort et l'apprend (`wt:dissolved`, raison `dissolved`, à ses
 * appareils liés), ses autres appareils perdent l'avis « en cours ailleurs ». Aucun départ n'est
 * diffusé entre-temps : toute la salle s'en va. Le dernier départ la supprime, invitations
 * comprises (`removeMember`). Rend le nombre de membres prévenus.
 */
export function dissolveRoom(room: Room): number {
  let notified = 0;
  for (const userId of [...room.members.keys()]) {
    const result = removeMemberAndSync(userId);
    if (!result) continue;
    notifyDissolved(result.removed, room.groupId, "dissolved");
    notifyElsewhere(userId);
    notified += 1;
  }
  return notified;
}
