/**
 * Octave — les PERSONNES d'une playlist partagée telles qu'on les montre (nom et photo Jellyfin, rien d'autre),
 * et les comptes à qui la partager. Un invité de la Famille n'apparaît dans AUCUNE liste
 * (`withoutFamilyGuests`) ; un compte désactivé ou disparu non plus — ni candidat, ni membre affiché.
 */

import type { MusicPlaylistMember, MusicPlaylistPerson, MusicPlaylistSharing } from "../contract/musicPlaylistMembers";
import { getJellyfinUsers, type CachedJellyfinUser } from "../../services/watchTogether/usersCache";
import { withoutFamilyGuests } from "../../services/family/familyGuestMarkers";
import { hasOctaveAccess } from "../../services/octaveRights/octaveAccess";
import { idOf, type MemberRow } from "./memberStore";
import type { PlaylistAccess } from "./playlistAccess";

export type PeopleIndex = ReadonlyMap<string, CachedJellyfinUser>;

/** Les comptes connus de Jellyfin, par identifiant (sans tirets, en minuscules) ; vide si Jellyfin est muet. */
export async function peopleIndex(): Promise<PeopleIndex> {
  const users = (await getJellyfinUsers().catch(() => null)) ?? [];
  return new Map(users.map((u) => [idOf(u.id), u]));
}

export function personOf(index: PeopleIndex, userId: string): MusicPlaylistPerson | null {
  const user = index.get(idOf(userId));
  return user ? { userId: idOf(user.id), name: user.name, imageTag: user.hasAvatar ? user.imageTag ?? "" : null } : null;
}

/**
 * Le partage vu par le compte qui lit ; `undefined` : une playlist que personne d'autre ne voit (aucun membre
 * et pas membre lui-même — sauf `evenUnshared`, la feuille de partage du propriétaire), ou un compte sans droit
 * (playlist publique de Jellyfin).
 */
export function sharingOf(
  access: Pick<PlaylistAccess, "right" | "readerId">,
  members: readonly MemberRow[],
  index: PeopleIndex,
  options: { evenUnshared?: boolean } = {},
): MusicPlaylistSharing | undefined {
  if (access.right === null) return undefined;
  if (access.right === "owner" && members.length === 0 && !options.evenUnshared) return undefined;
  const ownerId = access.right === "owner" ? access.readerId : (members[0]?.ownerUserId ?? access.readerId);
  const owner = personOf(index, ownerId) ?? { userId: idOf(ownerId), name: "", imageTag: null };
  const shown: MusicPlaylistMember[] = [];
  for (const m of members) {
    const person = personOf(index, m.memberId);
    if (person && !index.get(m.memberId)?.isDisabled) shown.push({ ...person, right: m.right });
  }
  return { role: access.right === "owner" ? "owner" : "member", right: access.right, owner, members: shown };
}

/** Les comptes à qui partager : ni soi, ni invité de la Famille, ni compte désactivé ou sans « Accès à Octave ». */
export async function shareCandidates(userId: string): Promise<MusicPlaylistPerson[] | null> {
  const users = await getJellyfinUsers().catch(() => null);
  if (!users) return null;
  const listed = await withoutFamilyGuests(users, (u) => u.id);
  const me = idOf(userId);
  const out: MusicPlaylistPerson[] = [];
  for (const u of listed) {
    if (u.isDisabled || idOf(u.id) === me) continue;
    if (!(await hasOctaveAccess(u.id).catch(() => false))) continue;
    out.push({ userId: idOf(u.id), name: u.name, imageTag: u.hasAvatar ? u.imageTag ?? "" : null });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Ce compte peut-il recevoir une playlist (un candidat) ? Le même filtre, pour un seul compte. */
export async function mayReceive(ownerId: string, memberId: string): Promise<boolean> {
  const candidates = await shareCandidates(ownerId);
  return !!candidates?.some((c) => c.userId === idOf(memberId));
}
