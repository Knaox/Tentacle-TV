import {
  familyPath,
  type AccountFamilyRightsDto,
  type FamilyCreationDefaults,
  type GuestParentalDto,
  type MemberRoleDto,
  type PromptsResetDto,
  type SetAccountFamilyRightsBody,
  type SetFamilyCreationDefaultsBody,
  type SetMemberParentalBody,
} from "@tentacle-tv/shared";
import { tentacleApiFetch } from "../hooks/usePreferences";

/**
 * Parents, membres mineurs et droits de création (serveur 1.30.0 — capacités
 * `family.roles`, `family.memberParental`, `family.creationRights`). Les gestes de
 * la famille portent la session PERSONNELLE ; ceux de l'administration, un
 * administrateur en session personnelle. Contrat : `@tentacle-tv/shared` ›
 * `family/familyRoles.ts`.
 */

function put<T>(path: string, body: unknown): Promise<T> {
  return tentacleApiFetch<T>(path, { method: "PUT", body: JSON.stringify(body) });
}

/** Le propriétaire nomme un membre parent, ou le lui retire. */
export function setFamilyMemberRole(input: { userId: string; parent: boolean }): Promise<MemberRoleDto> {
  return put(familyPath("setMemberRole", { userId: input.userId }), { parent: input.parent });
}

/** Le contrôle parental d'un membre mineur (le contrôle ENTIER ; aucun réglage = retiré, base rendue). */
export function setFamilyMemberParental(input: { userId: string; parental: SetMemberParentalBody }): Promise<GuestParentalDto> {
  return put(familyPath("setMemberParental", { userId: input.userId }), input.parental);
}

/** « Reproposer le code PIN et la photo » à ce profil (1.30.0, `family.promptsReset`) : aucun corps. */
export function resetFamilyPrompts(userId: string): Promise<PromptsResetDto> {
  return tentacleApiFetch<PromptsResetDto>(familyPath("resetPrompts", { userId }), { method: "POST" });
}

export function fetchFamilyCreationDefaults(): Promise<FamilyCreationDefaults> {
  return tentacleApiFetch<FamilyCreationDefaults>(familyPath("adminCreationDefaults"));
}

export function setFamilyCreationDefaults(patch: SetFamilyCreationDefaultsBody): Promise<FamilyCreationDefaults> {
  return put(familyPath("adminSetCreationDefaults"), patch);
}

export function fetchAccountFamilyRights(userId: string): Promise<AccountFamilyRightsDto> {
  return tentacleApiFetch<AccountFamilyRightsDto>(familyPath("adminAccountRights", { userId }));
}

export function setAccountFamilyRights(input: { userId: string; rights: SetAccountFamilyRightsBody }): Promise<AccountFamilyRightsDto> {
  return put(familyPath("adminSetAccountRights", { userId: input.userId }), input.rights);
}
