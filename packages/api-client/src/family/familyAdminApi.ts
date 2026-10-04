import { familyPath, type FamilySwitches } from "@tentacle-tv/shared";
import { tentacleApiFetch } from "../hooks/usePreferences";

/**
 * Les deux interrupteurs de la Famille dans l'administration (« Familles »,
 * « Profils invités ») : un administrateur, en session personnelle. Les couper
 * ferme aussitôt, côté serveur, les sessions de profil concernées.
 */

export function fetchFamilySwitches(): Promise<FamilySwitches> {
  return tentacleApiFetch<FamilySwitches>(familyPath("adminSwitches"));
}

export function setFamilySwitches(patch: Partial<FamilySwitches>): Promise<FamilySwitches> {
  return tentacleApiFetch<FamilySwitches>(familyPath("adminSetSwitches"), { method: "PUT", body: JSON.stringify(patch) });
}
