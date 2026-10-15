import {
  USER_RIGHTS_REFUSALS,
  familyPath,
  isUserRightsKey,
  userRightsPath,
  type FamilyParentalOptionsDto,
  type GuestParentalDto,
  type SetGuestParentalBody,
  type UserRightsDto,
  type UserRightsOptions,
  type UserRightsPatch,
  type UserRightsRefusalBody,
} from "@tentacle-tv/shared";
import { TentacleApiError, tentacleApiFetch } from "../hooks/usePreferences";

/**
 * Les droits d'un compte, lus et écrits dans SA politique Jellyfin par le
 * serveur (`requirePersonalAdmin`) : aucune copie locale, chaque réponse est
 * l'état RELU après écriture. Le contrôle parental d'un invité passe, lui, par
 * la Famille (session personnelle du propriétaire ou du membre créateur).
 * Contrat : `@tentacle-tv/shared` › `userRights/`, `family/familyParental.ts`.
 */

export function fetchUserRightsOptions(): Promise<UserRightsOptions> {
  return tentacleApiFetch<UserRightsOptions>(userRightsPath("options"));
}

export function fetchUserRights(userId: string): Promise<UserRightsDto> {
  return tentacleApiFetch<UserRightsDto>(userRightsPath("read", { userId }));
}

export function patchUserRights(input: { userId: string; patch: UserRightsPatch }): Promise<UserRightsDto> {
  return tentacleApiFetch<UserRightsDto>(userRightsPath("update", { userId: input.userId }), {
    method: "PATCH",
    body: JSON.stringify(input.patch),
  });
}

export function fetchFamilyParentalOptions(): Promise<FamilyParentalOptionsDto> {
  return tentacleApiFetch<FamilyParentalOptionsDto>(familyPath("parentalOptions"));
}

export function setFamilyGuestParental(input: { userId: string; parental: SetGuestParentalBody }): Promise<GuestParentalDto> {
  return tentacleApiFetch<GuestParentalDto>(familyPath("setGuestParental", { userId: input.userId }), {
    method: "PUT",
    body: JSON.stringify(input.parental),
  });
}

/** Le refus du serveur (`{ error, fields? }`, liste fermée) porté par une erreur d'appel ; null sinon. */
export function userRightsRefusalOf(error: unknown): UserRightsRefusalBody | null {
  if (!(error instanceof TentacleApiError)) return null;
  try {
    const body = JSON.parse(error.message) as { error?: unknown; fields?: unknown };
    const code = body?.error;
    if (typeof code !== "string" || !(USER_RIGHTS_REFUSALS as readonly string[]).includes(code)) return null;
    const fields = Array.isArray(body.fields) ? body.fields.filter(isUserRightsKey) : undefined;
    return { error: code as UserRightsRefusalBody["error"], ...(fields?.length ? { fields } : {}) };
  } catch {
    return null;
  }
}
