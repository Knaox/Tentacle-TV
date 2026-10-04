import { getPrisma } from "../db";
import type { FamilyMemberRights, SetMemberRightsBody } from "../../family/familyContract";
import { refuseReviewAccount } from "./familyConfig";
import { FamilyFailure } from "./familyErrors";
import { forgetFamilyGuests } from "./familyGuestMarkers";
import type { Actor } from "./familyInvitations";
import { withFamilyLock } from "./familyLock";
import { clearInvitationBell, familyUpdate, ringBell } from "./familyNotify";
import { endFamilyOnOwnerTvs, endProfileEverywhere, endProfileOnOwnerTvs } from "./familySessions";
import { deleteGuestAccount } from "./guestAccounts";
import { familyProfiles, findFamily, findOwnedFamily, findProfile, membershipsOf, ownerRefusal, type FamilyRow } from "./familyStore";

/**
 * Sortir de la Famille : un membre retiré par le propriétaire, un membre qui
 * part, une famille dissoute, un compte supprimé. Retirer un membre ne touche
 * JAMAIS son compte Jellyfin (SEC-F-10) ; dissoudre supprime les comptes des
 * invités. Chaque sortie coupe d'abord les sessions de profil concernées.
 */

export async function removeMember(owner: Actor, memberUserId: string): Promise<{ removed: true }> {
  await refuseReviewAccount(owner.userId);
  const family = await findOwnedFamily(owner.userId);
  const row = family ? await findProfile(family.id, memberUserId) : null;
  if (!family || !row || row.kind !== "member") throw await ownerRefusal(owner.userId, memberUserId);
  await withFamilyLock(owner.userId, async () => {
    const current = await findProfile(family.id, memberUserId);
    if (!current || current.kind !== "member") throw new FamilyFailure("family.not_found", "Introuvable");
    await getPrisma().familyMember.deleteMany({ where: { id: current.id } });
    await endProfileOnOwnerTvs(owner.userId, current.userId, "removed");
  });
  await ringBell(row.userId, "family_member_removed", family.ownerName, family.id);
  familyUpdate([row.userId], "memberships");
  familyUpdate([owner.userId], "owned");
  console.log(`[family] Membre retiré de la famille ${family.id}`);
  return { removed: true };
}

/** Le propriétaire règle les droits d'un membre (v2). Retirer un droit ne
 *  supprime rien : le membre ne peut plus, c'est tout. */
export async function setMemberRights(owner: Actor, memberUserId: string, patch: SetMemberRightsBody): Promise<FamilyMemberRights> {
  await refuseReviewAccount(owner.userId);
  const family = await findOwnedFamily(owner.userId);
  const row = family ? await findProfile(family.id, memberUserId) : null;
  if (!family || !row || row.kind !== "member") throw await ownerRefusal(owner.userId, memberUserId);
  const updated = await withFamilyLock(owner.userId, async () => {
    const current = await findProfile(family.id, memberUserId);
    if (!current || current.kind !== "member") throw new FamilyFailure("family.not_found", "Introuvable");
    if (patch.createGuests === undefined) return current;
    return getPrisma().familyMember.update({ where: { id: current.id }, data: { canCreateGuests: patch.createGuests } });
  });
  familyUpdate([owner.userId], "owned");
  familyUpdate([row.userId], "memberships");
  console.log(`[family] Droits d'un membre réglés dans la famille ${family.id}`);
  return { createGuests: updated.canCreateGuests === true };
}

export async function leaveFamily(caller: Actor, familyId: string): Promise<{ left: true }> {
  const family = await findFamily(familyId);
  const row = family ? await findProfile(family.id, caller.userId) : null;
  if (!family || !row || row.kind !== "member") throw new FamilyFailure("family.not_found", "Introuvable");
  await withFamilyLock(family.ownerUserId, async () => {
    const current = await findProfile(family.id, caller.userId);
    if (!current || current.kind !== "member") throw new FamilyFailure("family.not_found", "Introuvable");
    await getPrisma().familyMember.deleteMany({ where: { id: current.id } });
    await endProfileOnOwnerTvs(family.ownerUserId, caller.userId, "left");
  });
  await ringBell(family.ownerUserId, "family_member_left", caller.username, family.id);
  familyUpdate([family.ownerUserId], "owned");
  familyUpdate([caller.userId], "memberships");
  console.log(`[family] Un membre a quitté la famille ${family.id}`);
  return { left: true };
}

/** Membres sortis, invités supprimés de Jellyfin, invitations closes. Un
 *  invité que Jellyfin refuse de supprimer arrête la dissolution : la famille
 *  reste, rien n'est à moitié fait, le geste se rejoue. */
async function dissolve(family: FamilyRow, now: number): Promise<{ members: string[]; invitees: string[] }> {
  const prisma = getPrisma();
  await endFamilyOnOwnerTvs(family.ownerUserId, "dissolved");
  const rows = await familyProfiles(family.id);
  for (const guest of rows.filter((row) => row.kind === "guest")) {
    await endProfileOnOwnerTvs(family.ownerUserId, guest.userId, "dissolved");
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

export async function dissolveFamily(owner: Actor, now: number): Promise<{ dissolved: true }> {
  await refuseReviewAccount(owner.userId);
  const family = await findOwnedFamily(owner.userId);
  if (!family) throw await ownerRefusal(owner.userId, null);
  const { members, invitees } = await withFamilyLock(owner.userId, () => dissolve(family, now));
  for (const member of members) await ringBell(member, "family_dissolved", family.ownerName, family.id);
  familyUpdate(members, "memberships");
  familyUpdate(invitees, "invitations");
  familyUpdate([owner.userId], "owned");
  console.log(`[family] Famille ${family.id} dissoute`);
  return { dissolved: true };
}

/**
 * Un compte qui n'existe plus (supprimé par Tentacle, ou disparu de Jellyfin) :
 * sa famille dissoute, ses adhésions retirées, ses invitations closes, son
 * PIN effacé, ses sessions de profil coupées partout.
 */
export async function forgetFamilyAccount(userId: string, now: number): Promise<void> {
  const prisma = getPrisma();
  const owned = await findOwnedFamily(userId);
  if (owned) {
    const { members, invitees } = await withFamilyLock(userId, () => dissolve(owned, now));
    for (const member of members) await ringBell(member, "family_dissolved", owned.ownerName, owned.id);
    familyUpdate(members, "memberships");
    familyUpdate(invitees, "invitations");
  }
  for (const { row, family } of await membershipsOf(userId)) {
    await withFamilyLock(family.ownerUserId, async () => {
      await prisma.familyMember.deleteMany({ where: { id: row.id } });
      await endProfileOnOwnerTvs(family.ownerUserId, userId, "account_deleted");
    });
    await ringBell(family.ownerUserId, "family_member_left", row.displayName, family.id);
    familyUpdate([family.ownerUserId], "owned");
  }
  // Un invité dont le compte a disparu de Jellyfin : sa ligne s'en va.
  for (const guest of await prisma.familyMember.findMany({ where: { userId, kind: "guest" } })) {
    const family = await findFamily(guest.familyId);
    if (family) await endProfileOnOwnerTvs(family.ownerUserId, userId, "guest_deleted");
    await prisma.familyMember.deleteMany({ where: { id: guest.id } });
    if (family) familyUpdate([family.ownerUserId], "owned");
    forgetFamilyGuests();
  }
  const invitations = await prisma.familyInvitation.findMany({ where: { inviteeUserId: userId, status: "pending" } });
  await prisma.familyInvitation.updateMany({
    where: { inviteeUserId: userId, status: "pending" },
    data: { status: "cancelled", respondedAt: new Date(now) },
  });
  familyUpdate(invitations.map((invitation) => invitation.ownerUserId), "owned");
  await prisma.profilePin.deleteMany({ where: { userId } });
  await prisma.profilePinAttempt.deleteMany({ where: { userId } });
  await endProfileEverywhere(userId, "account_deleted");
  console.log("[family] Compte disparu : famille, adhésions et invitations soldées");
}
