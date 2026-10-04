import crypto from "crypto";
import { getPrisma } from "../db";
import { getJellyfinUsers } from "../watchTogether/usersCache";
import { FAMILY_INVITATION_TTL_MS, type OutgoingInvitationDto } from "../../family/familyContract";
import type { FamilyInvitationStatus } from "../../family/familyProtocol";
import { capacityError, inviteBlock, sameUserId, type InviteHistory } from "../../family/familyRules";
import { isReviewAccount, refuseReviewAccount, requireFamilies } from "./familyConfig";
import { FamilyFailure, iso } from "./familyErrors";
import { isFamilyGuest } from "./familyGuestMarkers";
import { withFamilyLock } from "./familyLock";
import { clearInvitationBell, familyUpdate, notifyFamily, pushInvitation, ringBell } from "./familyNotify";
import { invitationDates } from "./familyOverview";
import { ensureOwnedFamily, familyCounts, familyOf, findProfile } from "./familyStore";

/**
 * Inviter et annuler (le propriétaire). L'inviteur est le PORTEUR du jeton,
 * jamais un champ du corps (SEC-F-01) ; l'invité est un compte du serveur,
 * actif, ni soi-même, ni un invité, ni le compte de démonstration — un refus
 * ne dit jamais lequel (`family.candidate_invalid`, SEC-F-22). L'identifiant
 * d'une invitation : 128 bits aléatoires, jamais journalisé en entier.
 *
 * v2 — UNE famille par compte : seul le propriétaire invite (un membre reçoit
 * `family.not_owner`, un compte sans famille fonde la sienne), et la cible
 * n'est dans aucune famille (`family.already_in_family`). Qui entre dans une
 * famille — en la fondant, ou en acceptant — voit ses invitations reçues
 * closes : il n'en rejoindra pas d'autre.
 */

export interface Actor {
  userId: string;
  username: string;
}

export function newInvitationId(): string {
  return crypto.randomBytes(16).toString("base64url");
}

/** Le début d'un identifiant d'invitation : ce que les journaux en montrent (SEC-F-27). */
export function shortId(id: string): string {
  return `${id.slice(0, 6)}…`;
}

export function invitationNotFound(): FamilyFailure {
  return new FamilyFailure("family.not_found", "Introuvable");
}

export function invitationClosed(status: string): FamilyFailure {
  if (status === "expired") return new FamilyFailure("family.invite_expired", "Invitation expirée", { status: "expired" });
  return new FamilyFailure("family.invite_closed", "Invitation close", { status: status as FamilyInvitationStatus });
}

async function inviteHistory(ownerUserId: string, inviteeUserId: string, now: number): Promise<InviteHistory> {
  const prisma = getPrisma();
  const valid = { status: "pending", expiresAt: { gt: new Date(now) } };
  const [pending, declined, sent, inviteePending] = await Promise.all([
    prisma.familyInvitation.count({ where: { ownerUserId, inviteeUserId, ...valid } }),
    prisma.familyInvitation.findFirst({ where: { ownerUserId, inviteeUserId, status: "declined" }, orderBy: { respondedAt: "desc" } }),
    prisma.familyInvitation.findMany({ where: { ownerUserId, createdAt: { gt: new Date(now - 24 * 3_600_000) } }, select: { createdAt: true } }),
    prisma.familyInvitation.count({ where: { inviteeUserId, ...valid } }),
  ]);
  return {
    pendingForInvitee: pending > 0,
    lastDeclinedAt: declined?.respondedAt?.getTime() ?? null,
    sentInLastDay: sent.map((row) => row.createdAt.getTime()),
    inviteePendingTotal: inviteePending,
  };
}

function notOwner(): FamilyFailure {
  return new FamilyFailure("family.not_owner", "Un membre n'invite personne : réservé au propriétaire");
}

/** La cible est-elle libre ? Dans la famille de l'inviteur : `already_member` ;
 *  dans une autre : `already_in_family` (une famille par compte). */
async function targetBlock(targetUserId: string, ownFamilyId: string | null): Promise<FamilyFailure | null> {
  const theirs = await familyOf(targetUserId);
  if (!theirs) return null;
  if (theirs.family.id === ownFamilyId) return new FamilyFailure("family.already_member", "Déjà dans la famille");
  return new FamilyFailure("family.already_in_family", "Ce compte est déjà dans une famille");
}

export async function inviteMember(owner: Actor, inviteeUserId: string, now: number): Promise<OutgoingInvitationDto> {
  requireFamilies();
  if (await isReviewAccount(owner.userId)) throw new FamilyFailure("family.review_account", "Compte de démonstration : aucune invitation");
  if (await isFamilyGuest(owner.userId)) throw new FamilyFailure("family.guest_account", "Un invité n'invite personne");
  const mine = await familyOf(owner.userId);
  if (mine?.role === "member") throw notOwner();
  const users = await getJellyfinUsers();
  if (!users) throw new FamilyFailure("family.jellyfin_unavailable", "Comptes Jellyfin indisponibles");
  const target = users.find((user) => sameUserId(user.id, inviteeUserId));
  const invalid = new FamilyFailure("family.candidate_invalid", "Compte non invitable");
  if (!target || target.isDisabled || sameUserId(target.id, owner.userId)) throw invalid;
  if ((await isFamilyGuest(target.id)) || (await isReviewAccount(target.id))) throw invalid;
  const taken = await targetBlock(target.id, mine?.family.id ?? null);
  if (taken) throw taken;

  const { created, founded } = await withFamilyLock(owner.userId, async () => {
    const current = await familyOf(owner.userId);
    if (current?.role === "member") throw notOwner();
    const existing = current?.family ?? null;
    if (existing && (await findProfile(existing.id, target.id))) throw new FamilyFailure("family.already_member", "Déjà dans la famille");
    const counts = existing ? await familyCounts(existing.id, now) : { members: 0, guests: 0, pendingInvitations: 0 };
    const full = capacityError("member", counts);
    if (full) throw new FamilyFailure(full, "Famille complète");
    const block = inviteBlock(await inviteHistory(owner.userId, target.id, now), now);
    if (block) {
      throw new FamilyFailure(block.code, "Invitation retenue par les gardes anti-abus", block.retryAt ? { retryAt: iso(block.retryAt) } : {});
    }
    const family = existing ?? (await ensureOwnedFamily({ userId: owner.userId, name: owner.username }));
    const invitation = await getPrisma().familyInvitation.create({
      data: {
        id: newInvitationId(),
        familyId: family.id,
        ownerUserId: owner.userId,
        inviteeUserId: target.id,
        inviteeName: target.name,
        status: "pending",
        expiresAt: new Date(now + FAMILY_INVITATION_TTL_MS),
      },
    });
    return { created: invitation, founded: existing === null };
  });

  if (founded) await closeIncomingInvitations(owner.userId, now);
  await ringBell(target.id, "family_invite", owner.username, created.id);
  familyUpdate([target.id], "invitations");
  await notifyFamily(created.familyId);
  void pushInvitation(target.id, owner.username, created.id).catch(() => console.log("[family] push d'invitation en échec"));
  console.log(`[family] Invitation ${shortId(created.id)} envoyée`);
  return { id: created.id, inviteeUserId: target.id, inviteeName: target.name, ...invitationDates(created) };
}

/** Le propriétaire retire une invitation. Le destinataire, lui, refuse : 403. */
export async function cancelInvitation(caller: Actor, id: string, now: number): Promise<{ cancelled: true }> {
  await refuseReviewAccount(caller.userId);
  const prisma = getPrisma();
  const invitation = await prisma.familyInvitation.findUnique({ where: { id } });
  if (!invitation || !sameUserId(invitation.ownerUserId, caller.userId)) {
    if (invitation && sameUserId(invitation.inviteeUserId, caller.userId)) {
      throw new FamilyFailure("family.not_owner", "Seul l'émetteur annule une invitation");
    }
    throw invitationNotFound();
  }
  const { count } = await prisma.familyInvitation.updateMany({
    where: { id, status: "pending" },
    data: { status: "cancelled", respondedAt: new Date(now) },
  });
  if (count === 0) throw invitationClosed(invitation.status);
  await clearInvitationBell(invitation.inviteeUserId, id);
  familyUpdate([invitation.inviteeUserId], "invitations");
  familyUpdate([caller.userId], "family");
  console.log(`[family] Invitation ${shortId(id)} annulée`);
  return { cancelled: true };
}

/** Un compte entré dans une famille n'en rejoint pas d'autre : ses invitations
 *  reçues encore en attente (sauf `except`, celle qu'il accepte) sont closes,
 *  quittent sa cloche, et leurs familles relisent. */
export async function closeIncomingInvitations(userId: string, now: number, except?: string): Promise<void> {
  const prisma = getPrisma();
  const pending = (await prisma.familyInvitation.findMany({ where: { inviteeUserId: userId, status: "pending" } }))
    .filter((row) => row.id !== except);
  if (pending.length === 0) return;
  for (const row of pending) {
    const { count } = await prisma.familyInvitation.updateMany({
      where: { id: row.id, status: "pending" },
      data: { status: "cancelled", respondedAt: new Date(now) },
    });
    if (count > 0) await clearInvitationBell(userId, row.id);
  }
  familyUpdate([userId], "invitations");
  for (const familyId of new Set(pending.map((row) => row.familyId))) await notifyFamily(familyId);
  console.log(`[family] ${pending.length} invitation(s) reçue(s) close(s) : le compte est entré dans une famille`);
}
