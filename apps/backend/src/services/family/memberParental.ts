import { getUserRightsOptions } from "../userRights/userRightsOptions";
import { UserRightsFailure } from "../userRights/userRightsFailure";
import type { FamilyProfileDto } from "../../family/familyContract";
import { GUEST_PARENTAL_NONE, type GuestParentalDto } from "../../family/familyParental";
import { isParentalNone } from "../../family/familyRoles";
import { patchAgainstOptions } from "../../userRights/userRightsPatch";
import { refuseReviewAccount } from "./familyConfig";
import { FamilyFailure } from "./familyErrors";
import type { Actor } from "./familyInvitations";
import { withFamilyLock } from "./familyLock";
import { notifyFamily } from "./familyNotify";
import { familyOf, findProfile, type FamilyRow, type MemberRow } from "./familyStore";
import { fetchUser } from "./guestAccounts";
import { parseGuestParental } from "./guestParentalPolicy";
import { parentalOfPolicy } from "./memberParentalRules";
import type { JellyfinPolicy } from "../userRights/policyMapping";
import { readMemberParental, saveMemberParental, type MemberParentalState } from "./memberParentalStore";
import { settleMemberParental } from "./memberParentalSync";

/**
 * Le contrôle parental d'un MEMBRE mineur, posé par la famille (docs/DROITS-UTILISATEURS.md
 * § 9.4) : le propriétaire ou un parent, sur un membre qui n'est ni le propriétaire, ni un
 * parent, ni un administrateur Jellyfin. Le voulu et la base sont gardés D'ABORD, puis la
 * politique effective est écrite et relue ; aucun réglage = retiré, la base rendue.
 */

function unavailable(error: unknown): FamilyFailure {
  if (error instanceof FamilyFailure) return error;
  if (error instanceof UserRightsFailure && error.code === "jellyfin_refused") return new FamilyFailure("family.jellyfin_refused", "Jellyfin a refusé");
  return new FamilyFailure("family.jellyfin_unavailable", "Jellyfin ne répond pas");
}

function refused(): FamilyFailure {
  return new FamilyFailure("family.member_parental_refused", "Pas de contrôle parental sur le propriétaire, un parent ou un administrateur");
}

/** Le propriétaire de la famille, ou un parent ? (la règle de `manageMinors`) */
export function regulatesMinors(mine: { role: "owner" | "member"; self: MemberRow }): boolean {
  return mine.role === "owner" || mine.self.isParent === true;
}

/** Le membre visé, s'il est dans la famille du porteur et que le porteur le règle : 404 hors de sa
 *  famille, 403 pour un simple membre, 409 sur le propriétaire, un parent ou un invité. */
export async function regulableMember(actor: Actor, memberUserId: string): Promise<{ family: FamilyRow; row: MemberRow }> {
  await refuseReviewAccount(actor.userId);
  const mine = await familyOf(actor.userId);
  const row = mine ? await findProfile(mine.family.id, memberUserId) : null;
  if (!mine || !row) throw new FamilyFailure("family.not_found", "Introuvable");
  if (!regulatesMinors(mine)) throw new FamilyFailure("family.not_owner", "Réservé au propriétaire ou à un parent");
  if (row.kind !== "member" || row.isParent === true) throw refused();
  return { family: mine.family, row };
}

export async function setMemberParental(actor: Actor, memberUserId: string, body: unknown): Promise<GuestParentalDto> {
  const wanted = parseGuestParental(body);
  if (!wanted) throw new FamilyFailure("family.invalid_input", "Contrôle parental invalide");
  const { family, row: target } = await regulableMember(actor, memberUserId);
  const user = await fetchUser(target.userId);
  if (user.Policy?.IsAdministrator !== false) throw refused();
  if (wanted.maxParentalRating !== null) {
    const options = await getUserRightsOptions().catch((error: unknown) => {
      throw unavailable(error);
    });
    if (patchAgainstOptions({ maxParentalRating: wanted.maxParentalRating, maxParentalSubRating: wanted.maxParentalSubRating }, options).length) {
      throw new FamilyFailure("family.invalid_input", "Note inconnue de Jellyfin");
    }
  }
  const remove = isParentalNone(wanted);
  const state = await withFamilyLock(family.ownerUserId, async (): Promise<MemberParentalState | null> => {
    const { row } = await regulableMember(actor, memberUserId);
    const existing = await readMemberParental(row.userId);
    if (remove) {
      if (!existing) return null;
      // Ses bibliothèques restent restreintes s'il y en a : seule la base de l'âge est rendue.
      const pending: MemberParentalState = { ...existing, controls: null, restorePending: existing.libraries === null };
      await saveMemberParental(pending);
      return pending;
    }
    // Première pose : la base est la politique en cours, et c'est aussi la « dernière écriture » connue.
    const current = parentalOfPolicy(user.Policy ?? {});
    const next: MemberParentalState = existing
      ? { ...existing, familyId: family.id, controls: wanted, restorePending: false }
      : {
          userId: row.userId, familyId: family.id, controls: wanted, base: current, written: current, restorePending: false,
          libraries: null, libraryBase: null, libraryWritten: null,
        };
    await saveMemberParental(next);
    return next;
  });
  // Gardé d'abord : si Jellyfin se tait ici, le guet le posera (ou rendra la base) dès son retour.
  const settled = state ? await settleMemberParental(state, await fetchUser(target.userId), true).catch((error: unknown) => {
    throw unavailable(error);
  }) : null;
  await notifyFamily(family.id);
  console.log(`[family] Contrôle parental d'un membre ${remove ? "retiré" : "réglé"} dans la famille ${family.id}`);
  const ceiling = settled?.state?.base ?? parentalOfPolicy((await fetchUser(target.userId).catch(() => user)).Policy ?? {});
  return { parental: remove ? { ...GUEST_PARENTAL_NONE } : wanted, parentalCeiling: ceiling };
}

/**
 * Un membre, vu par le propriétaire ou un parent : son contrôle voulu et, pour plafond, sa
 * BASE (gardée, sinon sa politique en cours). Rien sur un administrateur Jellyfin, ni quand
 * Jellyfin se tait : on ne sait pas s'il peut être restreint.
 */
export function memberParentalView(profile: FamilyProfileDto, policy: JellyfinPolicy | undefined, state: MemberParentalState | undefined): FamilyProfileDto {
  if (!policy || policy.IsAdministrator !== false) return profile;
  return {
    ...profile,
    parental: state?.controls ?? { ...GUEST_PARENTAL_NONE },
    parentalCeiling: state?.base ?? parentalOfPolicy(policy),
  };
}
