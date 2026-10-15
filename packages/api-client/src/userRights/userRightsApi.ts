import { TentacleApiError, tentacleApiFetch } from "../hooks/usePreferences";
import {
  FAMILY_PARENTAL_PATHS,
  USER_RIGHTS_PATHS,
  USER_RIGHTS_REFUSALS,
  type FamilyParentalOptions,
  type GuestParentalControls,
  type UserRightsDto,
  type UserRightsOptions,
  type UserRightsPatch,
  type UserRightsRefusal,
} from "./userRightsTypes";

/**
 * Les droits d'un compte, lus et écrits dans SA politique Jellyfin par le
 * serveur (`requirePersonalAdmin`) : aucune copie locale, chaque réponse est
 * l'état RELU après écriture. Le contrôle parental d'un invité passe, lui, par
 * la Famille (session personnelle du propriétaire ou du membre créateur).
 */

export function fetchUserRightsOptions(): Promise<UserRightsOptions> {
  return tentacleApiFetch<UserRightsOptions>(USER_RIGHTS_PATHS.options);
}

export function fetchUserRights(userId: string): Promise<UserRightsDto> {
  return tentacleApiFetch<UserRightsDto>(USER_RIGHTS_PATHS.user(userId));
}

export function patchUserRights(input: { userId: string; patch: UserRightsPatch }): Promise<UserRightsDto> {
  return tentacleApiFetch<UserRightsDto>(USER_RIGHTS_PATHS.user(input.userId), {
    method: "PATCH",
    body: JSON.stringify(input.patch),
  });
}

export function fetchFamilyParentalOptions(): Promise<FamilyParentalOptions> {
  return tentacleApiFetch<FamilyParentalOptions>(FAMILY_PARENTAL_PATHS.options);
}

export function setFamilyGuestParental(input: { userId: string; parental: GuestParentalControls }): Promise<GuestParentalControls> {
  return tentacleApiFetch<GuestParentalControls>(FAMILY_PARENTAL_PATHS.guest(input.userId), {
    method: "PUT",
    body: JSON.stringify(input.parental),
  });
}

/** Le refus du serveur (`{ error }`, liste fermée) porté par une erreur d'appel ; null sinon. */
export function userRightsRefusalOf(error: unknown): UserRightsRefusal | null {
  if (!(error instanceof TentacleApiError)) return null;
  try {
    const body = JSON.parse(error.message) as { error?: unknown };
    const code = body?.error;
    return typeof code === "string" && (USER_RIGHTS_REFUSALS as readonly string[]).includes(code)
      ? (code as UserRightsRefusal)
      : null;
  } catch {
    return null;
  }
}
