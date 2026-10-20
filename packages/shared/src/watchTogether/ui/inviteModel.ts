import { matchesSearch } from "../../utils/textSearch";
import type { WtInvitableUserDto, WtRoomStateDto } from "../../types/watchTogether";

/**
 * Watch Together — la liste « Inviter des membres », règles du web
 * (`InviteView`) : déjà dans le groupe = absent ; déjà invité = visible,
 * grisé ; en ligne d'abord (elles peuvent rejoindre maintenant), puis par nom.
 */

export interface InviteCandidate {
  user: WtInvitableUserDto;
  invited: boolean;
}

export function inviteCandidates(
  users: readonly WtInvitableUserDto[],
  room: WtRoomStateDto,
  pendingUserIds: ReadonlySet<string>,
  query: string,
): InviteCandidate[] {
  const inRoom = new Set(room.members.map((m) => m.userId));
  const q = query.trim();
  return users
    .filter((u) => !inRoom.has(u.id))
    .filter((u) => q === "" || matchesSearch(u.name, q))
    .sort((a, b) => Number(b.isOnline) - Number(a.isOnline) || a.name.localeCompare(b.name))
    .map((user) => ({ user, invited: pendingUserIds.has(user.id) }));
}

/** Coche ou décoche une personne (une personne déjà invitée ne se coche pas). */
export function toggleSelection(
  selection: ReadonlyMap<string, WtInvitableUserDto>,
  candidate: InviteCandidate,
): ReadonlyMap<string, WtInvitableUserDto> {
  if (candidate.invited) return selection;
  const next = new Map(selection);
  if (next.has(candidate.user.id)) next.delete(candidate.user.id);
  else next.set(candidate.user.id, candidate.user);
  return next;
}
