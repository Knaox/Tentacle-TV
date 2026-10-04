import { getPrisma } from "../db";
import { loadPushLangs } from "../pushLang";
import type { FamilyGuestRights, FamilyProfileColor, FamilyProfileDto, SetGuestRightsBody } from "../../family/familyContract";
import { canManageGuest, familyRightsOf } from "../../family/familyRights";
import { capacityError, guestQuotaBlock, normalizeGuestName } from "../../family/familyRules";
import { getFamilySwitches, isReviewAccount, refuseReviewAccount, requireGuests } from "./familyConfig";
import { FamilyFailure, iso } from "./familyErrors";
import { forgetFamilyGuests, isFamilyGuest } from "./familyGuestMarkers";
import type { Actor } from "./familyInvitations";
import { closeIncomingInvitations } from "./familyInvitations";
import { withFamilyLock } from "./familyLock";
import { notifyFamily } from "./familyNotify";
import { writePin } from "./familyPins";
import { endProfileEverywhere } from "./familySessions";
import { abandonGuestAccount, cleanupGuestAccount, retireGuestRow, settleCreatedGuest } from "./guestAccountCleanup";
import { createGuestAccount } from "./guestAccounts";
import {
  ensureOwnedFamily,
  familyCounts,
  familyOf,
  familyProfiles,
  findProfile,
  fold,
  ownerRefusal,
  type FamilyRow,
  type MemberRow,
} from "./familyStore";

/**
 * Les invités d'une famille et leur PIN (docs/FAMILLE.md) — le sien, chacun le
 * change dans `familyOwnPin.ts`. Créer un invité,
 * c'est créer un compte Jellyfin : sous le verrou de la famille (trois au
 * plus, six profils au plus — SEC-F-33), dans la limite de six par jour et
 * par famille (SEC-F-23), jamais pour le compte de démonstration (SEC-F-28).
 *
 * v2 : le propriétaire, ou un membre à qui il l'a permis, crée un invité dans
 * la famille PARTAGÉE — avec la politique Jellyfin de son CRÉATEUR. Le
 * propriétaire gère tous les invités ; un membre, ceux qu'il a créés
 * (`canManageGuest`). Supprimer un invité coupe ses sessions de TV puis
 * supprime son compte — par le journal durable (`guestAccountCleanup.ts`).
 */

const DAY_MS = 24 * 3_600_000;
/** Créations récentes par famille (clé : son propriétaire), suppressions
 *  comprises (pas de création et de suppression en rafale) ; la base garde
 *  les invités encore là. */
const recentCreations = new Map<string, number[]>();

/** Les bancs repartent d'une journée vierge. */
export function resetGuestCreationsForTests(): void {
  recentCreations.clear();
}

function rightRequired(): FamilyFailure {
  return new FamilyFailure("family.guest_right_required", "Le propriétaire n'a pas permis à ce membre de créer des invités");
}

/** L'invité visé, s'il est dans la famille du porteur et à sa main : 404 hors
 *  de sa famille, 403 sur un invité qu'il n'a pas créé (membre). */
async function manageableGuest(actor: Actor, guestUserId: string): Promise<{ row: MemberRow; family: FamilyRow }> {
  await refuseReviewAccount(actor.userId);
  const mine = await familyOf(actor.userId);
  const row = mine ? await findProfile(mine.family.id, guestUserId) : null;
  if (!mine || !row || row.kind !== "guest") throw new FamilyFailure("family.not_found", "Introuvable");
  const rights = familyRightsOf(mine.role, { createGuests: mine.self.canCreateGuests === true }, getFamilySwitches());
  if (!canManageGuest(rights, row.createdBy ?? mine.family.ownerUserId, actor.userId)) {
    throw new FamilyFailure("family.not_owner", "Réservé au propriétaire ou au créateur de l'invité");
  }
  return { row, family: mine.family };
}

export async function createGuest(actor: Actor, body: { name: unknown; color: FamilyProfileColor }, now: number): Promise<FamilyProfileDto> {
  requireGuests();
  if (await isReviewAccount(actor.userId)) throw new FamilyFailure("family.review_account", "Compte de démonstration : aucun invité");
  if (await isFamilyGuest(actor.userId)) throw new FamilyFailure("family.guest_account", "Un invité ne crée pas d'invité");
  const name = normalizeGuestName(body.name);
  if (!name) throw new FamilyFailure("family.invalid_input", "Nom d'invité vide");
  const before = await familyOf(actor.userId);
  if (before?.role === "member" && !before.self.canCreateGuests) throw rightRequired();
  // Le verrou de la famille : celle du porteur, ou celle qu'il fondera.
  const lockKey = before?.family.ownerUserId ?? actor.userId;

  const { row, founded } = await withFamilyLock(lockKey, async () => {
    const mine = await familyOf(actor.userId);
    if ((mine?.family.ownerUserId ?? actor.userId) !== lockKey) throw new FamilyFailure("family.not_found", "La famille a changé");
    if (mine?.role === "member" && !mine.self.canCreateGuests) throw rightRequired();
    const existing = mine?.family ?? null;
    const counts = existing ? await familyCounts(existing.id, now) : { members: 0, guests: 0, pendingInvitations: 0 };
    const full = capacityError("guest", counts);
    if (full) throw new FamilyFailure(full, "Plus de place pour un invité");
    const key = fold(lockKey);
    const remembered = (recentCreations.get(key) ?? []).filter((at) => now - at < DAY_MS);
    const persisted = existing
      ? (await familyProfiles(existing.id)).filter((entry) => entry.kind === "guest").map((entry) => entry.createdAt.getTime())
      : [];
    const block = guestQuotaBlock(remembered.length >= persisted.length ? remembered : persisted, now);
    if (block) throw new FamilyFailure(block.code, "Trop d'invités créés aujourd'hui", block.retryAt ? { retryAt: iso(block.retryAt) } : {});

    const lang = (await loadPushLangs([actor.userId])).get(actor.userId) ?? "fr";
    const account = await createGuestAccount({ guestName: name, creator: { userId: actor.userId, name: actor.username }, lang });
    try {
      const family = existing ?? (await ensureOwnedFamily({ userId: actor.userId, name: actor.username }));
      const created = await getPrisma().familyMember.create({
        data: {
          familyId: family.id,
          userId: account.userId,
          kind: "guest",
          displayName: name,
          color: body.color,
          jellyfinName: account.jellyfinName,
          createdBy: actor.userId,
        },
      });
      recentCreations.set(key, [...remembered, now]);
      console.log(`[family] Invité créé (compte Jellyfin « ${account.jellyfinName} »)`);
      return { row: created, founded: existing === null };
    } catch (error) {
      await abandonGuestAccount(account.userId, account.jellyfinName);
      throw error;
    }
  });
  // La ligne porte le compte. Si ce solde échoue, le balayage le fera : un
  // invité vivant n'est jamais supprimé.
  await settleCreatedGuest(row.userId).catch(() => undefined);
  forgetFamilyGuests();
  if (founded) await closeIncomingInvitations(actor.userId, now);
  await notifyFamily(row.familyId);
  return {
    userId: row.userId,
    kind: "guest",
    name: row.displayName,
    color: body.color,
    hasPin: false,
    imageTag: null,
    since: row.createdAt.toISOString(),
    createdBy: actor.userId,
    createdByName: actor.username,
    rights: null,
    guestRights: { requestTitles: false },
  };
}

/** Le propriétaire — lui SEUL — règle les droits d'un invité (v2). « Peut
 *  demander » : la session de l'invité utilise les extensions à SON PROPRE
 *  nom (`familyGuestExtensions.ts`). Lu à chaque requête : le retirer coupe à
 *  l'appel suivant ; l'invité l'apprend aussi par son socket. */
export async function setGuestRights(owner: Actor, guestUserId: string, patch: SetGuestRightsBody): Promise<FamilyGuestRights> {
  await refuseReviewAccount(owner.userId);
  const mine = await familyOf(owner.userId);
  if (mine?.role !== "owner") throw await ownerRefusal(owner.userId, guestUserId);
  const updated = await withFamilyLock(owner.userId, async () => {
    const row = await findProfile(mine.family.id, guestUserId);
    if (!row || row.kind !== "guest") throw await ownerRefusal(owner.userId, guestUserId);
    if (patch.requestTitles === undefined) return row;
    return getPrisma().familyMember.update({ where: { id: row.id }, data: { canRequestTitles: patch.requestTitles } });
  });
  await notifyFamily(mine.family.id, [updated.userId]);
  console.log(`[family] Droits d'un invité réglés dans la famille ${mine.family.id}`);
  return { requestTitles: updated.canRequestTitles === true };
}

/** Sessions coupées sur toutes les TV ; l'invité quitte la base et son compte
 *  entre au journal des suppressions, ensemble ; puis le compte part de
 *  Jellyfin — aussitôt, et jusqu'à confirmation sinon : un Jellyfin muet
 *  n'arrête plus le geste. Sa lecture est perdue. */
export async function deleteGuest(actor: Actor, guestUserId: string): Promise<{ deleted: true }> {
  const { family } = await manageableGuest(actor, guestUserId);
  const userId = await withFamilyLock(family.ownerUserId, async () => {
    const { row } = await manageableGuest(actor, guestUserId);
    await endProfileEverywhere(row.userId, "guest_deleted");
    await retireGuestRow(row, "guest_deleted");
    console.log(`[family] Invité supprimé (compte Jellyfin « ${row.jellyfinName ?? "?"} »)`);
    return row.userId;
  });
  await notifyFamily(family.id);
  await cleanupGuestAccount(userId).catch(() => false);
  return { deleted: true };
}

/** Le PIN d'un invité, posé par le propriétaire ou par son créateur : ses sessions de TV tombent. */
export async function setGuestPin(actor: Actor, guestUserId: string, pin: string | null): Promise<{ hasPin: boolean }> {
  const { row, family } = await manageableGuest(actor, guestUserId);
  await writePin(row.userId, pin);
  await endProfileEverywhere(row.userId, "pin_changed");
  await notifyFamily(family.id);
  return { hasPin: pin !== null };
}

