/**
 * Octave — les MEMBRES d'une playlist partagée (`music_playlist_members`, contrat `musicPlaylistMembers.ts`).
 * Identifiants sans tirets, en minuscules. Le droit est relu à CHAQUE geste : rien n'est gardé en mémoire.
 */

import { getPrisma } from "../../services/db";
import { parseMemberRight, type MusicPlaylistMemberRight } from "../contract/musicPlaylistMembers";

export interface MemberRow {
  playlistId: string;
  memberId: string;
  ownerUserId: string;
  right: MusicPlaylistMemberRight;
  createdAt: number;
}

export function idOf(raw: string): string {
  return raw.replace(/-/g, "").toLowerCase();
}

function rowOf(row: { playlistId: string; memberId: string; ownerUserId: string; right: string; createdAt: Date }): MemberRow | null {
  const right = parseMemberRight(row.right);
  return right ? { playlistId: row.playlistId, memberId: row.memberId, ownerUserId: row.ownerUserId, right, createdAt: row.createdAt.getTime() } : null;
}

function rows(list: Parameters<typeof rowOf>[0][]): MemberRow[] {
  return list.map(rowOf).filter((r): r is MemberRow => r !== null);
}

/** Les membres d'une playlist, dans l'ordre où ils ont été ajoutés. */
export async function membersOf(playlistId: string): Promise<MemberRow[]> {
  return rows(await getPrisma().musicPlaylistMember.findMany({ where: { playlistId: idOf(playlistId) }, orderBy: { createdAt: "asc" } }));
}

/** Les membres de plusieurs playlists à la fois (la liste d'un compte : une requête). */
export async function membersOfMany(playlistIds: readonly string[]): Promise<Map<string, MemberRow[]>> {
  const out = new Map<string, MemberRow[]>();
  if (playlistIds.length === 0) return out;
  const found = rows(await getPrisma().musicPlaylistMember.findMany({ where: { playlistId: { in: playlistIds.map(idOf) } }, orderBy: { createdAt: "asc" } }));
  for (const row of found) out.set(row.playlistId, [...(out.get(row.playlistId) ?? []), row]);
  return out;
}

/** Les playlists partagées AVEC ce compte. */
export async function membershipsOf(memberId: string): Promise<MemberRow[]> {
  return rows(await getPrisma().musicPlaylistMember.findMany({ where: { memberId: idOf(memberId) }, orderBy: { createdAt: "asc" } }));
}

export async function membershipOf(playlistId: string, memberId: string): Promise<MemberRow | null> {
  const row = await getPrisma().musicPlaylistMember.findUnique({ where: { playlistId_memberId: { playlistId: idOf(playlistId), memberId: idOf(memberId) } } });
  return row ? rowOf(row) : null;
}

/** Ajoute ce membre, ou change son droit ; rend `true` s'il est nouveau. */
export async function putMember(playlistId: string, ownerUserId: string, memberId: string, right: MusicPlaylistMemberRight): Promise<boolean> {
  const key = { playlistId: idOf(playlistId), memberId: idOf(memberId) };
  const before = await getPrisma().musicPlaylistMember.findUnique({ where: { playlistId_memberId: key } });
  await getPrisma().musicPlaylistMember.upsert({
    where: { playlistId_memberId: key },
    create: { ...key, ownerUserId: idOf(ownerUserId), right },
    update: { right, ownerUserId: idOf(ownerUserId) },
  });
  return before === null;
}

/** Retire ce membre ; rend `true` s'il l'était. */
export async function dropMember(playlistId: string, memberId: string): Promise<boolean> {
  const { count } = await getPrisma().musicPlaylistMember.deleteMany({ where: { playlistId: idOf(playlistId), memberId: idOf(memberId) } });
  return count > 0;
}

/** Une playlist supprimée : ses membres partent avec elle. Rend ceux qu'elle avait (à prévenir). */
export async function forgetPlaylistMembers(playlistId: string): Promise<string[]> {
  const before = await membersOf(playlistId);
  await getPrisma().musicPlaylistMember.deleteMany({ where: { playlistId: idOf(playlistId) } });
  return before.map((m) => m.memberId);
}
