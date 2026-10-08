import { getPrisma } from "../db";
import { FAMILY_SNOOZE_MS, type FamilyMembershipDto, type IncomingInvitationDto } from "../../family/familyContract";
import { canAcceptInvitation, sameUserId } from "../../family/familyRules";
import { isReviewAccount, requireFamilies } from "./familyConfig";
import { FamilyFailure } from "./familyErrors";
import { isFamilyGuest } from "./familyGuestMarkers";
import { type Actor, closeIncomingInvitations, invitationClosed, invitationNotFound, shortId } from "./familyInvitations";
import { withFamilyLock } from "./familyLock";
import { clearInvitationBell, familyUpdate, notifyFamily, ringBell } from "./familyNotify";
import { invitationDates } from "./familyOverview";
import { familyCounts, familyOf, findFamily, findProfile, isUniqueViolation } from "./familyStore";

/**
 * Répondre à une invitation (le destinataire, en session PERSONNELLE — la
 * route l'exige) : accepter, refuser, « plus tard ». Le destinataire est le
 * porteur du jeton (SEC-F-02) ; pour tout autre compte l'invitation n'existe
 * pas (404, SEC-F-03). Une invitation échue ne s'accepte plus (410, SEC-F-05).
 * v2 : on n'accepte que sans famille (`family.already_in_family`) — l'unicité
 * de la base tranche une course —, et accepter clôt les autres invitations.
 */

function alreadyInFamily(): FamilyFailure {
  return new FamilyFailure("family.already_in_family", "Déjà dans une famille : une seule par compte");
}

type InvitationRow = NonNullable<Awaited<ReturnType<ReturnType<typeof getPrisma>["familyInvitation"]["findUnique"]>>>;

/** L'invitation d'un destinataire, encore en attente — sinon le bon refus. */
async function pendingFor(caller: Actor, id: string, now: number): Promise<InvitationRow> {
  const invitation = await getPrisma().familyInvitation.findUnique({ where: { id } });
  if (!invitation || !sameUserId(invitation.inviteeUserId, caller.userId)) throw invitationNotFound();
  if (invitation.status === "pending" && invitation.expiresAt.getTime() <= now) {
    await expireInvitation(invitation, now);
    throw invitationClosed("expired");
  }
  if (invitation.status !== "pending") throw invitationClosed(invitation.status);
  return invitation;
}

export async function acceptInvitation(caller: Actor, id: string, now: number): Promise<FamilyMembershipDto> {
  if (await isReviewAccount(caller.userId)) throw new FamilyFailure("family.review_account", "Compte de démonstration : aucune famille");
  if (await isFamilyGuest(caller.userId)) throw new FamilyFailure("family.guest_account", "Un invité ne rejoint aucune famille");
  requireFamilies();
  const first = await pendingFor(caller, id, now);
  if (await familyOf(caller.userId)) throw alreadyInFamily();
  const prisma = getPrisma();
  const membership = await withFamilyLock(first.ownerUserId, async () => {
    const invitation = await pendingFor(caller, id, now);
    const family = await findFamily(invitation.familyId);
    if (!family) {
      await prisma.familyInvitation.updateMany({ where: { id, status: "pending" }, data: { status: "cancelled", respondedAt: new Date(now) } });
      throw invitationClosed("cancelled");
    }
    if (await findProfile(family.id, caller.userId)) throw new FamilyFailure("family.already_member", "Déjà dans la famille");
    if (!canAcceptInvitation(await familyCounts(family.id, now))) throw new FamilyFailure("family.full", "Famille complète");
    // La ligne d'abord : si le compte vient d'entrer ailleurs (fondé sa
    // famille, accepté une autre invitation), l'unicité la refuse.
    let row;
    try {
      row = await prisma.familyMember.create({
        data: { familyId: family.id, userId: caller.userId, kind: "member", displayName: caller.username.slice(0, 100) },
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw alreadyInFamily();
      throw error;
    }
    const { count } = await prisma.familyInvitation.updateMany({
      where: { id, status: "pending" },
      data: { status: "accepted", respondedAt: new Date(now) },
    });
    if (count === 0) {
      await prisma.familyMember.deleteMany({ where: { id: row.id } });
      throw invitationClosed("cancelled");
    }
    return { familyId: family.id, ownerUserId: family.ownerUserId, ownerName: family.ownerName, since: row.createdAt.toISOString() };
  });
  await clearInvitationBell(caller.userId, id);
  await closeIncomingInvitations(caller.userId, now, id);
  await ringBell(first.ownerUserId, "family_invite_accepted", caller.username, id);
  await notifyFamily(membership.familyId);
  familyUpdate([caller.userId], "invitations");
  console.log(`[family] Invitation ${shortId(id)} acceptée`);
  return membership;
}

export async function declineInvitation(caller: Actor, id: string, now: number): Promise<{ declined: true }> {
  const invitation = await pendingFor(caller, id, now);
  const { count } = await getPrisma().familyInvitation.updateMany({
    where: { id, status: "pending" },
    data: { status: "declined", respondedAt: new Date(now) },
  });
  if (count === 0) throw invitationClosed("cancelled");
  await clearInvitationBell(caller.userId, id);
  await ringBell(invitation.ownerUserId, "family_invite_declined", caller.username, id);
  familyUpdate([invitation.ownerUserId], "family");
  familyUpdate([caller.userId], "invitations");
  console.log(`[family] Invitation ${shortId(id)} refusée`);
  return { declined: true };
}

/** « Plus tard » : l'affiche se tait un jour, la cloche garde l'invitation. */
export async function snoozeInvitation(caller: Actor, id: string, now: number): Promise<IncomingInvitationDto> {
  const invitation = await pendingFor(caller, id, now);
  const snoozedUntil = new Date(now + FAMILY_SNOOZE_MS);
  await getPrisma().familyInvitation.updateMany({ where: { id, status: "pending" }, data: { snoozedUntil } });
  const family = await findFamily(invitation.familyId);
  familyUpdate([caller.userId], "invitations");
  return {
    id,
    familyId: invitation.familyId,
    ownerUserId: invitation.ownerUserId,
    ownerName: family?.ownerName ?? "",
    ...invitationDates(invitation),
    snoozedUntil: snoozedUntil.toISOString(),
  };
}

/** Une invitation échue : marquée, retirée de la cloche, les deux parties relisent. */
export async function expireInvitation(invitation: InvitationRow, now: number): Promise<void> {
  const { count } = await getPrisma().familyInvitation.updateMany({
    where: { id: invitation.id, status: "pending" },
    data: { status: "expired", respondedAt: new Date(now) },
  });
  if (count === 0) return;
  await clearInvitationBell(invitation.inviteeUserId, invitation.id);
  familyUpdate([invitation.inviteeUserId], "invitations");
  familyUpdate([invitation.ownerUserId], "family");
}

/** Le balayage : toutes les invitations échues. */
export async function expireDueInvitations(now: number): Promise<number> {
  const due = await getPrisma().familyInvitation.findMany({
    where: { status: "pending", expiresAt: { lte: new Date(now) } },
    // Les plus anciennes d'abord : un lot borné ne doit pas laisser traîner les mêmes.
    orderBy: { expiresAt: "asc" },
    take: 200,
  });
  for (const invitation of due) await expireInvitation(invitation, now);
  return due.length;
}
