import { getPrisma } from "../db";
import type { FamilyMemberRights, SetMemberRightsBody } from "../../family/familyContract";
import { refuseReviewAccount } from "./familyConfig";
import { FamilyFailure } from "./familyErrors";
import { forgetFamilyGuests } from "./familyGuestMarkers";
import type { Actor } from "./familyInvitations";
import { withFamilyLock } from "./familyLock";
import { clearInvitationBell, familyUpdate, notifyFamily, ringBell } from "./familyNotify";
import { endForeignOnTvsOf, endMemberLink, endProfileEverywhere } from "./familySessions";
import { deleteGuestAccount } from "./guestAccounts";
import { familyOf, familyProfiles, findFamily, findOwnedFamily, fold, ownerRefusal, personsOf, type FamilyRow } from "./familyStore";

/**
 * Sortir de la Famille : un membre retiré par le propriétaire, un membre qui
 * part, une famille dissoute, un compte supprimé. Retirer un membre ne touche
 * JAMAIS son compte Jellyfin (SEC-F-10) ; dissoudre supprime les comptes des
 * invités, quel qu'en soit le créateur. Chaque sortie coupe d'abord les
 * sessions de profil concernées — v2 : sur les TV de TOUTE la famille.
 */

/** La famille du porteur, s'il en est le propriétaire — sinon le bon refus. */
async function ownedBy(owner: Actor, targetUserId: string | null): Promise<FamilyRow> {
  await refuseReviewAccount(owner.userId);
  const mine = await familyOf(owner.userId);
  if (mine?.role !== "owner") throw await ownerRefusal(owner.userId, targetUserId);
  return mine.family;
}

/** Une ligne de membre quitte la famille, sous son verrou : ses liens de TV
 *  tombent des deux côtés. Rend les personnes à prévenir. */
async function detachMember(family: FamilyRow, memberUserId: string, reason: "removed" | "left" | "account_deleted"): Promise<string[]> {
  return withFamilyLock(family.ownerUserId, async () => {
    const rows = await familyProfiles(family.id);
    const row = rows.find((entry) => fold(entry.userId) === fold(memberUserId));
    if (!row || row.kind !== "member") throw new FamilyFailure("family.not_found", "Introuvable");
    await getPrisma().familyMember.deleteMany({ where: { id: row.id } });
    const persons = personsOf(family, rows);
    await endMemberLink(persons.filter((userId) => fold(userId) !== fold(row.userId)), row.userId, reason);
    return persons;
  });
}

export async function removeMember(owner: Actor, memberUserId: string): Promise<{ removed: true }> {
  const family = await ownedBy(owner, memberUserId);
  const row = (await familyProfiles(family.id)).find((entry) => fold(entry.userId) === fold(memberUserId));
  if (!row || row.kind !== "member") throw await ownerRefusal(owner.userId, memberUserId);
  const persons = await detachMember(family, row.userId, "removed");
  await ringBell(row.userId, "family_member_removed", family.ownerName, family.id);
  familyUpdate(persons, "family");
  console.log(`[family] Membre retiré de la famille ${family.id}`);
  return { removed: true };
}

/** Un membre quitte SA famille ; le propriétaire ne la quitte pas, il la dissout. */
export async function leaveFamily(caller: Actor, familyId: string): Promise<{ left: true }> {
  const mine = await familyOf(caller.userId);
  if (!mine || mine.family.id !== familyId) throw new FamilyFailure("family.not_found", "Introuvable");
  if (mine.role === "owner") throw new FamilyFailure("family.owner_must_dissolve", "Le propriétaire dissout sa famille");
  const persons = await detachMember(mine.family, caller.userId, "left");
  await ringBell(mine.family.ownerUserId, "family_member_left", caller.username, mine.family.id);
  familyUpdate(persons, "family");
  console.log(`[family] Un membre a quitté la famille ${mine.family.id}`);
  return { left: true };
}

/** Le propriétaire règle les droits d'un membre (v2). Retirer un droit ne
 *  supprime rien : le membre ne peut plus, c'est tout. */
export async function setMemberRights(owner: Actor, memberUserId: string, patch: SetMemberRightsBody): Promise<FamilyMemberRights> {
  const family = await ownedBy(owner, memberUserId);
  const updated = await withFamilyLock(owner.userId, async () => {
    const row = (await familyProfiles(family.id)).find((entry) => fold(entry.userId) === fold(memberUserId));
    if (!row || row.kind !== "member") throw await ownerRefusal(owner.userId, memberUserId);
    if (patch.createGuests === undefined) return row;
    return getPrisma().familyMember.update({ where: { id: row.id }, data: { canCreateGuests: patch.createGuests } });
  });
  await notifyFamily(family.id);
  console.log(`[family] Droits d'un membre réglés dans la famille ${family.id}`);
  return { createGuests: updated.canCreateGuests === true };
}

/** Les TV de toute la famille ne gardent que leur propre compte, les invités
 *  sont supprimés de Jellyfin, les membres sortent, les invitations se closent.
 *  Un invité que Jellyfin refuse de supprimer arrête la dissolution : la
 *  famille reste, rien n'est à moitié fait, le geste se rejoue. */
async function dissolve(family: FamilyRow, now: number): Promise<{ members: string[]; invitees: string[] }> {
  const prisma = getPrisma();
  const rows = await familyProfiles(family.id);
  await endForeignOnTvsOf(personsOf(family, rows), "dissolved");
  for (const guest of rows.filter((row) => row.kind === "guest")) {
    await endProfileEverywhere(guest.userId, "dissolved");
    await deleteGuestAccount(guest.userId);
    await prisma.familyMember.deleteMany({ where: { id: guest.id } });
    await prisma.profilePin.deleteMany({ where: { userId: guest.userId } });
    await prisma.profilePinAttempt.deleteMany({ where: { userId: guest.userId } });
  }
  forgetFamilyGuests();
  const members = rows.filter((row) => row.kind === "member").map((row) => row.userId);
  await prisma.familyMember.deleteMany({ where: { familyId: family.id } });
  const pending = await prisma.familyInvitation.findMany({ where: { familyId: family.id, status: "pending" } });
  await prisma.familyInvitation.updateMany({
    where: { familyId: family.id, status: "pending" },
    data: { status: "cancelled", respondedAt: new Date(now) },
  });
  for (const invitation of pending) await clearInvitationBell(invitation.inviteeUserId, invitation.id);
  await prisma.family.deleteMany({ where: { id: family.id } });
  return { members, invitees: pending.map((invitation) => invitation.inviteeUserId) };
}

async function announceDissolved(family: FamilyRow, result: { members: string[]; invitees: string[] }): Promise<void> {
  for (const member of result.members) await ringBell(member, "family_dissolved", family.ownerName, family.id);
  familyUpdate([family.ownerUserId, ...result.members], "family");
  familyUpdate(result.invitees, "invitations");
}

export async function dissolveFamily(owner: Actor, now: number): Promise<{ dissolved: true }> {
  const family = await ownedBy(owner, null);
  const result = await withFamilyLock(owner.userId, () => dissolve(family, now));
  await announceDissolved(family, result);
  console.log(`[family] Famille ${family.id} dissoute`);
  return { dissolved: true };
}

/**
 * Un compte qui n'existe plus (supprimé par Tentacle, ou disparu de Jellyfin) :
 * sa famille dissoute s'il la possédait, son adhésion retirée s'il était
 * membre, sa ligne d'invité effacée ; ses invitations closes, son PIN effacé,
 * ses sessions de profil coupées partout.
 */
export async function forgetFamilyAccount(userId: string, now: number): Promise<void> {
  const prisma = getPrisma();
  const row = await prisma.familyMember.findUnique({ where: { userId } });
  // Sans ligne, une famille possédée reste possible sur une base pas encore migrée.
  const family = row ? await findFamily(row.familyId) : await findOwnedFamily(userId);
  if ((row?.kind === "owner" || !row) && family) {
    await announceDissolved(family, await withFamilyLock(family.ownerUserId, () => dissolve(family, now)));
  } else if (row?.kind === "member" && family) {
    const persons = await detachMember(family, userId, "account_deleted");
    await ringBell(family.ownerUserId, "family_member_left", row.displayName, family.id);
    familyUpdate(persons, "family");
  } else if (row) {
    // Un invité dont le compte a disparu de Jellyfin (ou une ligne sans famille) : elle s'en va.
    await endProfileEverywhere(userId, "guest_deleted");
    await prisma.familyMember.deleteMany({ where: { id: row.id } });
    forgetFamilyGuests();
    if (family) await notifyFamily(family.id);
  }
  const invitations = await prisma.familyInvitation.findMany({ where: { inviteeUserId: userId, status: "pending" } });
  await prisma.familyInvitation.updateMany({
    where: { inviteeUserId: userId, status: "pending" },
    data: { status: "cancelled", respondedAt: new Date(now) },
  });
  for (const familyId of new Set(invitations.map((invitation) => invitation.familyId))) await notifyFamily(familyId);
  await prisma.profilePin.deleteMany({ where: { userId } });
  await prisma.profilePinAttempt.deleteMany({ where: { userId } });
  await endProfileEverywhere(userId, "account_deleted");
  console.log("[family] Compte disparu : famille, adhésion et invitations soldées");
}
