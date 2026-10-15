import type { FamilyOverviewDto, FamilyProfileDto } from "./familyContract";
import { isParentalNone } from "./familyRoles";
import { isOwnProfile } from "./familyClient";

/**
 * La Famille côté CLIENTS (web, bureau) — le RÔLE de parent et le contrôle
 * parental d'un membre mineur (serveur 1.30.0, `familyRoles.ts`). Ce que l'écran
 * MONTRE : rien n'y est décidé à la place du serveur, qui revérifie tout. Pas de
 * miroir. Module pur : `familyRolesClient.test.ts`.
 */

export interface ProfileRoleActions {
  /** Nommer ce membre parent, ou le lui retirer : le propriétaire, en session personnelle. */
  role: boolean;
  /** Le nommer parent est refusé tant qu'un contrôle parental le restreint : le retirer d'abord. */
  roleBlockedByParental: boolean;
  /** Régler le contrôle parental de ce MEMBRE : le propriétaire ou un parent, sur un membre que le
   *  serveur a rendu avec son état (il ne le rend que pour un membre qui peut être restreint). */
  memberParental: boolean;
}

const NONE: ProfileRoleActions = { role: false, roleBlockedByParental: false, memberParental: false };

/** Un contrôle parental posé (et pas « aucun ») sur ce profil — invité ou membre — tel que le serveur le rend. */
export function hasParentalControl(profile: Pick<FamilyProfileDto, "parental">): boolean {
  return !!profile.parental && !isParentalNone(profile.parental);
}

/** Ce membre est-il parent ? Un champ absent (serveur d'avant) : non. */
export function isFamilyParent(profile: Pick<FamilyProfileDto, "kind" | "parent">): boolean {
  return profile.kind === "member" && profile.parent === true;
}

/** Ce que CE compte peut faire du rôle et du contrôle parental d'UN membre de sa famille. */
export function profileRoleActions(
  overview: FamilyOverviewDto,
  profile: FamilyProfileDto,
  viewerUserId: string | null | undefined,
): ProfileRoleActions {
  const family = overview.family;
  if (!family || !overview.account.personalSession || !viewerUserId) return NONE;
  if (profile.kind !== "member" || isOwnProfile(profile, viewerUserId)) return NONE;
  const role = family.rights.manageRoles === true;
  const restricted = hasParentalControl(profile);
  return {
    role,
    roleBlockedByParental: role && restricted && !isFamilyParent(profile),
    memberParental: family.rights.manageMinors === true && !isFamilyParent(profile) && profile.parental !== undefined,
  };
}
