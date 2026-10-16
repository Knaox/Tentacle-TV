import { getPrisma } from "../db";
import { getUserRightsOptions } from "../userRights/userRightsOptions";
import { UserRightsFailure } from "../userRights/userRightsFailure";
import type { FamilyLibrariesDto } from "../../family/familyLibraries";
import { normalizeJellyfinId } from "../../userRights/userRightsPatch";
import { refuseReviewAccount } from "./familyConfig";
import { FamilyFailure } from "./familyErrors";
import { manageableGuest } from "./familyGuests";
import type { Actor } from "./familyInvitations";
import { withFamilyLock } from "./familyLock";
import { notifyFamily } from "./familyNotify";
import { familyOf, findProfile, type FamilyRow, type MemberRow } from "./familyStore";
import { fetchUser, type UserDto } from "./guestAccounts";
import { storedGuestParental } from "./guestParentalPolicy";
import { applyGuestPolicy } from "./guestPolicySync";
import {
  libraryAccessOfPolicy,
  librariesWithin,
  parseLibrariesBody,
  settledLibraryBase,
  storedWantedLibraries,
  type LibraryAccess,
  type WantedLibraries,
} from "./familyLibraryRules";
import { regulableMember } from "./memberParental";
import { parentalOfPolicy } from "./memberParentalRules";
import { readMemberParental, saveMemberParental, type MemberParentalState } from "./memberParentalStore";
import { settleMemberParental } from "./memberParentalSync";

/**
 * Les BIBLIOTHÈQUES qu'une famille permet à un invité ou à un membre mineur
 * (docs/DROITS-UTILISATEURS.md § 9.8, capacité `family.libraryLimits`). Mêmes
 * droits que son contrôle parental : `manageableGuest` pour un invité,
 * `regulableMember` pour un membre (jamais le propriétaire, un parent ni un
 * administrateur Jellyfin). La liste voulue est gardée D'ABORD, puis la
 * politique EFFECTIVE (plafond ∩ voulu) est écrite dans Jellyfin et relue —
 * l'invité par sa politique d'invité, le membre par `settleMemberParental`,
 * qui garde sa base et la rend au départ.
 */

type Target =
  | { kind: "guest"; family: FamilyRow; row: MemberRow; creatorUserId: string }
  | { kind: "member"; family: FamilyRow; row: MemberRow; user: UserDto };

function unavailable(error: unknown): FamilyFailure {
  if (error instanceof FamilyFailure) return error;
  if (error instanceof UserRightsFailure && error.code === "jellyfin_refused") return new FamilyFailure("family.jellyfin_refused", "Jellyfin a refusé");
  return new FamilyFailure("family.jellyfin_unavailable", "Jellyfin ne répond pas");
}

/** Le profil visé, si le porteur règle son contrôle parental — sinon le refus de ce contrôle. */
async function targetOf(actor: Actor, userId: string): Promise<Target> {
  await refuseReviewAccount(actor.userId);
  const mine = await familyOf(actor.userId);
  const row = mine ? await findProfile(mine.family.id, userId) : null;
  if (!mine || !row) throw new FamilyFailure("family.not_found", "Introuvable");
  if (row.kind === "guest") {
    const guest = await manageableGuest(actor, userId);
    return { kind: "guest", family: guest.family, row: guest.row, creatorUserId: guest.row.createdBy ?? guest.family.ownerUserId };
  }
  const member = await regulableMember(actor, userId);
  const user = await fetchUser(member.row.userId);
  if (user.Policy?.IsAdministrator !== false) {
    throw new FamilyFailure("family.member_parental_refused", "Pas de contrôle parental sur un administrateur");
  }
  return { kind: "member", family: member.family, row: member.row, user };
}

/** Le plafond et la liste voulue : le créateur d'un invité ; la base gardée (ou la politique) d'un membre. */
async function stateOf(target: Target): Promise<{ ceiling: LibraryAccess; allowed: WantedLibraries; member: MemberParentalState | null }> {
  if (target.kind === "guest") {
    const creator = await fetchUser(target.creatorUserId);
    return { ceiling: libraryAccessOfPolicy(creator.Policy ?? {}), allowed: storedWantedLibraries(target.row.libraryAccess), member: null };
  }
  const state = await readMemberParental(target.row.userId);
  const current = libraryAccessOfPolicy(target.user.Policy ?? {});
  const ceiling = state ? settledLibraryBase(state.libraryBase, state.libraryWritten, state.libraries, current) : current;
  return { ceiling, allowed: state?.libraries ?? null, member: state };
}

async function viewOf(ceiling: LibraryAccess, allowed: WantedLibraries): Promise<FamilyLibrariesDto> {
  const options = await getUserRightsOptions().catch((error: unknown) => {
    throw unavailable(error);
  });
  const available = librariesWithin(options.libraries, ceiling);
  return {
    available,
    allowed: allowed === null ? null : allowed.filter((id) => available.some((library) => normalizeJellyfinId(library.id) === normalizeJellyfinId(id))),
  };
}

export async function profileLibraries(actor: Actor, userId: string): Promise<FamilyLibrariesDto> {
  const target = await targetOf(actor, userId);
  const { ceiling, allowed } = await stateOf(target);
  return viewOf(ceiling, allowed);
}

export async function setProfileLibraries(actor: Actor, userId: string, body: unknown): Promise<FamilyLibrariesDto> {
  const parsed = parseLibrariesBody(body);
  if (!parsed) throw new FamilyFailure("family.invalid_input", "Bibliothèques invalides");
  const target = await targetOf(actor, userId);
  const { ceiling } = await stateOf(target);
  // Jamais une bibliothèque hors de ce que le profil verrait sans la famille, ni une que le serveur n'a pas.
  const allowed = parsed.allowed?.map(normalizeJellyfinId) ?? null;
  const { available } = await viewOf(ceiling, null);
  if (allowed && !allowed.every((id) => available.some((library) => normalizeJellyfinId(library.id) === id))) {
    throw new FamilyFailure("family.invalid_input", "Bibliothèque hors de portée");
  }
  if (target.kind === "guest") {
    const row = await withFamilyLock(target.family.ownerUserId, async () => {
      const { row: guest } = await manageableGuest(actor, userId);
      return getPrisma().familyMember.update({ where: { id: guest.id }, data: { libraryAccess: allowed ? JSON.stringify(allowed) : null } });
    });
    // Gardé d'abord : si Jellyfin se tait ici, le guet le posera dès son retour.
    await applyGuestPolicy(row.userId, target.creatorUserId, storedGuestParental(row.parentalControls ?? null));
  } else {
    const state = await withFamilyLock(target.family.ownerUserId, async (): Promise<MemberParentalState | null> => {
      const { row } = await regulableMember(actor, userId);
      const existing = await readMemberParental(row.userId);
      if (!existing && allowed === null) return null;
      const policy = target.user.Policy ?? {};
      const next: MemberParentalState = existing
        ? { ...existing, familyId: target.family.id, libraries: allowed, restorePending: existing.controls === null && allowed === null }
        : {
            userId: row.userId, familyId: target.family.id, controls: null, base: parentalOfPolicy(policy), written: parentalOfPolicy(policy),
            restorePending: false, libraries: allowed, libraryBase: libraryAccessOfPolicy(policy), libraryWritten: libraryAccessOfPolicy(policy),
          };
      await saveMemberParental(next);
      return next;
    });
    if (state) {
      await settleMemberParental(state, await fetchUser(target.row.userId), true).catch((error: unknown) => {
        throw unavailable(error);
      });
    }
  }
  await notifyFamily(target.family.id);
  console.log(`[family] Bibliothèques d'un ${target.kind === "guest" ? "invité" : "membre"} réglées dans la famille ${target.family.id}`);
  return viewOf(ceiling, allowed);
}
