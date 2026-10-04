import { getPrisma } from "../db";
import { loadPushLangs } from "../pushLang";
import type { FamilyProfileColor, FamilyProfileDto } from "../../family/familyContract";
import { capacityError, guestQuotaBlock, normalizeGuestName } from "../../family/familyRules";
import { isReviewAccount, refuseReviewAccount, requireGuests } from "./familyConfig";
import { FamilyFailure, iso } from "./familyErrors";
import { forgetFamilyGuests, isFamilyGuest } from "./familyGuestMarkers";
import type { Actor } from "./familyInvitations";
import { withFamilyLock } from "./familyLock";
import { familyUpdate } from "./familyNotify";
import { writePin } from "./familyPins";
import { endProfileEverywhere, endProfileOnOwnerTvs } from "./familySessions";
import { createGuestAccount, deleteGuestAccount } from "./guestAccounts";
import { ensureOwnedFamily, familyCounts, familyProfiles, findOwnedFamily, findProfile, fold, membershipsOf, ownerRefusal, type MemberRow } from "./familyStore";

/**
 * Les invités d'une famille et les PIN (docs/FAMILLE.md). Créer un invité,
 * c'est créer un compte Jellyfin : sous le verrou de la famille (trois au
 * plus, six profils au plus — SEC-F-33), dans la limite de six par jour et par
 * propriétaire (SEC-F-23), jamais pour le compte de démonstration (SEC-F-28).
 * Le supprimer coupe ses sessions de TV puis supprime son compte.
 */

const DAY_MS = 24 * 3_600_000;
/** Créations récentes par propriétaire, suppressions comprises (pas de création
 *  et de suppression en rafale) ; la base garde les invités encore là. */
const recentCreations = new Map<string, number[]>();

async function ownedGuest(owner: Actor, guestUserId: string): Promise<MemberRow> {
  await refuseReviewAccount(owner.userId);
  const family = await findOwnedFamily(owner.userId);
  const row = family ? await findProfile(family.id, guestUserId) : null;
  if (!row || row.kind !== "guest") throw await ownerRefusal(owner.userId, guestUserId);
  return row;
}

export async function createGuest(owner: Actor, body: { name: unknown; color: FamilyProfileColor }, now: number): Promise<FamilyProfileDto> {
  requireGuests();
  if (await isReviewAccount(owner.userId)) throw new FamilyFailure("family.review_account", "Compte de démonstration : aucun invité");
  if (await isFamilyGuest(owner.userId)) throw new FamilyFailure("family.guest_account", "Un invité ne crée pas d'invité");
  const name = normalizeGuestName(body.name);
  if (!name) throw new FamilyFailure("family.invalid_input", "Nom d'invité vide");

  const created = await withFamilyLock(owner.userId, async () => {
    const existing = await findOwnedFamily(owner.userId);
    const counts = existing ? await familyCounts(existing.id, now) : { members: 0, guests: 0, pendingInvitations: 0 };
    const full = capacityError("guest", counts);
    if (full) throw new FamilyFailure(full, "Plus de place pour un invité");
    const key = fold(owner.userId);
    const remembered = (recentCreations.get(key) ?? []).filter((at) => now - at < DAY_MS);
    const persisted = existing
      ? (await familyProfiles(existing.id)).filter((row) => row.kind === "guest").map((row) => row.createdAt.getTime())
      : [];
    const block = guestQuotaBlock(remembered.length >= persisted.length ? remembered : persisted, now);
    if (block) throw new FamilyFailure(block.code, "Trop d'invités créés aujourd'hui", block.retryAt ? { retryAt: iso(block.retryAt) } : {});

    const lang = (await loadPushLangs([owner.userId])).get(owner.userId) ?? "fr";
    const account = await createGuestAccount({ guestName: name, owner: { userId: owner.userId, name: owner.username }, lang });
    try {
      const family = existing ?? (await ensureOwnedFamily({ userId: owner.userId, name: owner.username }));
      const row = await getPrisma().familyMember.create({
        data: {
          familyId: family.id,
          userId: account.userId,
          kind: "guest",
          displayName: name,
          color: body.color,
          jellyfinName: account.jellyfinName,
          createdBy: owner.userId,
        },
      });
      recentCreations.set(key, [...remembered, now]);
      console.log(`[family] Invité créé (compte Jellyfin « ${account.jellyfinName} »)`);
      return row;
    } catch (error) {
      await deleteGuestAccount(account.userId).catch(() => undefined);
      throw error;
    }
  });
  forgetFamilyGuests();
  familyUpdate([owner.userId], "owned");
  return {
    userId: created.userId,
    kind: "guest",
    name: created.displayName,
    color: body.color,
    hasPin: false,
    imageTag: null,
    since: created.createdAt.toISOString(),
    createdBy: owner.userId,
    createdByName: owner.username,
    rights: null,
  };
}

/** Sessions coupées sur les TV, puis compte Jellyfin supprimé (sa lecture est perdue). */
export async function deleteGuest(owner: Actor, guestUserId: string): Promise<{ deleted: true }> {
  await ownedGuest(owner, guestUserId);
  await withFamilyLock(owner.userId, async () => {
    const row = await ownedGuest(owner, guestUserId);
    await endProfileOnOwnerTvs(owner.userId, row.userId, "guest_deleted");
    await deleteGuestAccount(row.userId);
    const prisma = getPrisma();
    await prisma.familyMember.deleteMany({ where: { id: row.id } });
    await prisma.profilePin.deleteMany({ where: { userId: row.userId } });
    await prisma.profilePinAttempt.deleteMany({ where: { userId: row.userId } });
    console.log(`[family] Invité supprimé (compte Jellyfin « ${row.jellyfinName ?? "?"} »)`);
  });
  forgetFamilyGuests();
  familyUpdate([owner.userId], "owned");
  return { deleted: true };
}

/** Le PIN d'un invité, posé par le propriétaire : ses sessions de TV tombent. */
export async function setGuestPin(owner: Actor, guestUserId: string, pin: string | null): Promise<{ hasPin: boolean }> {
  const row = await ownedGuest(owner, guestUserId);
  await writePin(row.userId, pin);
  await endProfileEverywhere(row.userId, "pin_changed");
  familyUpdate([owner.userId], "owned");
  return { hasPin: pin !== null };
}

/** Son propre PIN : ses sessions de profil tombent sur TOUTES les TV. */
export async function setOwnPin(caller: Actor, pin: string | null): Promise<{ hasPin: boolean }> {
  if (await isFamilyGuest(caller.userId)) throw new FamilyFailure("family.guest_account", "Un invité n'a pas de session personnelle");
  await writePin(caller.userId, pin);
  await endProfileEverywhere(caller.userId, "pin_changed");
  const owners = (await membershipsOf(caller.userId)).map(({ family }) => family.ownerUserId);
  familyUpdate([caller.userId, ...owners], "owned");
  return { hasPin: pin !== null };
}
