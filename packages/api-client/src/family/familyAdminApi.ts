import { familyPath, type FamilyAdminSwitchesDto, type FamilyLaunchPolicy, type FamilySwitches, type SetFamilyLaunchPolicyBody } from "@tentacle-tv/shared";
import { tentacleApiFetch } from "../hooks/usePreferences";

/**
 * Les deux interrupteurs de la Famille dans l'administration (« Familles »,
 * « Profils invités ») : un administrateur, en session personnelle. Les couper
 * ferme aussitôt, côté serveur, les sessions de profil concernées. 1.30.0 : « Les invités
 * peuvent demander des films » (`guestRequests`), montré si `requestExtension`.
 */

export function fetchFamilySwitches(): Promise<FamilyAdminSwitchesDto> {
  return tentacleApiFetch<FamilyAdminSwitchesDto>(familyPath("adminSwitches"));
}

export function setFamilySwitches(patch: Partial<FamilySwitches>): Promise<FamilyAdminSwitchesDto> {
  return tentacleApiFetch<FamilyAdminSwitchesDto>(familyPath("adminSetSwitches"), { method: "PUT", body: JSON.stringify(patch) });
}

/** « Qui regarde ? » à l'ouverture, plateforme par plateforme (serveur `family.pickerPolicy`). */
export function fetchFamilyLaunchPolicy(): Promise<FamilyLaunchPolicy> {
  return tentacleApiFetch<FamilyLaunchPolicy>(familyPath("adminLaunchPolicy"));
}

/** Seulement ce qui change ; la réponse est la politique entière, telle que gardée. */
export function setFamilyLaunchPolicy(patch: SetFamilyLaunchPolicyBody): Promise<FamilyLaunchPolicy> {
  return tentacleApiFetch<FamilyLaunchPolicy>(familyPath("adminSetLaunchPolicy"), { method: "PUT", body: JSON.stringify(patch) });
}
