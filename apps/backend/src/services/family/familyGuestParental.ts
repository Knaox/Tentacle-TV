import { getPrisma } from "../db";
import { jellyfinAdminFetch } from "../jellyfinAdminFetch";
import type { FamilyDto, FamilyProfileDto } from "../../family/familyContract";
import type { FamilyParentalOptionsDto, GuestParentalCeiling, GuestParentalDto } from "../../family/familyParental";
import { canManageGuest } from "../../family/familyRights";
import { patchAgainstOptions } from "../../userRights/userRightsPatch";
import { getUserRightsOptions } from "../userRights/userRightsOptions";
import { UserRightsFailure } from "../userRights/userRightsFailure";
import type { Actor } from "./familyInvitations";
import { FamilyFailure } from "./familyErrors";
import { manageableGuest } from "./familyGuests";
import { withFamilyLock } from "./familyLock";
import { notifyFamily } from "./familyNotify";
import { familyOf, familyProfiles, fold } from "./familyStore";
import { fetchUser, type UserDto } from "./guestAccounts";
import { ceilingFromPolicy, parseGuestParental, storedGuestParental } from "./guestParentalPolicy";
import { applyGuestPolicy } from "./guestPolicySync";
import { memberParentalView } from "./memberParental";
import { familyMemberParental } from "./memberParentalStore";

/**
 * Le contrôle parental d'un invité (docs/DROITS-UTILISATEURS.md § 4) : le
 * propriétaire règle celui de tout invité, un membre celui des siens
 * (`manageableGuest`). Le contrôle VOULU est gardé en base, puis la politique
 * EFFECTIVE (recoupée avec le créateur) est écrite dans Jellyfin et relue.
 */

function unavailable(error: unknown): FamilyFailure {
  if (error instanceof FamilyFailure) return error;
  if (error instanceof UserRightsFailure && error.code === "jellyfin_refused") return new FamilyFailure("family.jellyfin_refused", "Jellyfin a refusé");
  return new FamilyFailure("family.jellyfin_unavailable", "Jellyfin ne répond pas");
}

/** Le plafond du créateur, lu dans Jellyfin ; null s'il ne répond pas. */
async function ceilingOf(creatorUserId: string): Promise<GuestParentalCeiling | null> {
  try {
    return ceilingFromPolicy((await fetchUser(creatorUserId)).Policy ?? {});
  } catch {
    return null;
  }
}

export async function setGuestParental(actor: Actor, guestUserId: string, body: unknown): Promise<GuestParentalDto> {
  const wanted = parseGuestParental(body);
  if (!wanted) throw new FamilyFailure("family.invalid_input", "Contrôle parental invalide");
  const { family } = await manageableGuest(actor, guestUserId);
  if (wanted.maxParentalRating !== null || wanted.maxParentalSubRating !== null) {
    const options = await getUserRightsOptions().catch((error: unknown) => {
      throw unavailable(error);
    });
    if (patchAgainstOptions({ maxParentalRating: wanted.maxParentalRating, maxParentalSubRating: wanted.maxParentalSubRating }, options).length) {
      throw new FamilyFailure("family.invalid_input", "Note inconnue de Jellyfin");
    }
  }
  const { row, creatorUserId } = await withFamilyLock(family.ownerUserId, async () => {
    const { row } = await manageableGuest(actor, guestUserId);
    await getPrisma().familyMember.update({ where: { id: row.id }, data: { parentalControls: JSON.stringify(wanted) } });
    return { row, creatorUserId: row.createdBy ?? family.ownerUserId };
  });
  // Gardé d'abord : si Jellyfin se tait ici, le guet le posera dès son retour.
  await applyGuestPolicy(row.userId, creatorUserId, wanted);
  await notifyFamily(family.id);
  console.log(`[family] Contrôle parental d'un invité réglé dans la famille ${family.id}`);
  return { parental: wanted, parentalCeiling: await ceilingOf(creatorUserId) };
}

/** Les options du contrôle parental : à qui peut régler au moins un invité ou un membre (le propriétaire,
 *  un parent, un membre qui a créé un invité). */
export async function parentalOptions(actor: Actor): Promise<FamilyParentalOptionsDto> {
  const mine = await familyOf(actor.userId);
  if (!mine) throw new FamilyFailure("family.not_owner", "Aucun invité à régler");
  if (mine.role !== "owner" && mine.self.isParent !== true) {
    const own = (await familyProfiles(mine.family.id)).some((row) => row.kind === "guest" && fold(row.createdBy ?? "") === fold(actor.userId));
    if (!own) throw new FamilyFailure("family.not_owner", "Aucun invité à régler");
  }
  try {
    const { parentalRatings, unratedItemTypes, knownTags } = await getUserRightsOptions();
    return { parentalRatings, unratedItemTypes, knownTags };
  } catch (error) {
    throw unavailable(error);
  }
}

/**
 * L'état lu avec chaque invité que CE compte peut régler (session personnelle) :
 * `parental` (voulu) et `parentalCeiling` (son créateur) ; et, pour le propriétaire
 * et les parents, avec chaque membre qui peut être restreint (sa base pour plafond).
 * Les autres profils n'en portent rien. UNE lecture des comptes de Jellyfin.
 */
export async function withParentalState(family: FamilyDto, actorUserId: string): Promise<FamilyDto> {
  const rows = await familyProfiles(family.id);
  const ownerUserId = family.owner.userId;
  const mine = (profile: FamilyProfileDto) =>
    profile.kind === "guest" && canManageGuest(family.rights, profile.createdBy ?? ownerUserId, actorUserId);
  const minor = (profile: FamilyProfileDto) => family.rights.manageMinors === true && profile.kind === "member" && profile.parent !== true;
  if (!family.profiles.some((profile) => mine(profile) || minor(profile))) return family;
  const users = await jellyfinAdminFetch<UserDto[]>("/Users");
  const policies = new Map(
    (users.ok && Array.isArray(users.data) ? users.data : []).filter((user) => user.Id).map((user) => [fold(user.Id as string), user.Policy ?? {}]),
  );
  const states = family.profiles.some(minor) ? await familyMemberParental(family.id) : [];
  const profiles = family.profiles.map((profile): FamilyProfileDto => {
    if (minor(profile)) {
      const state = states.find((entry) => fold(entry.userId) === fold(profile.userId));
      return memberParentalView(profile, policies.get(fold(profile.userId)), state);
    }
    if (!mine(profile)) return profile;
    const row = rows.find((entry) => fold(entry.userId) === fold(profile.userId));
    const creator = policies.get(fold(profile.createdBy ?? ownerUserId));
    return { ...profile, parental: storedGuestParental(row?.parentalControls ?? null), parentalCeiling: creator ? ceilingFromPolicy(creator) : null };
  });
  return { ...family, profiles };
}
