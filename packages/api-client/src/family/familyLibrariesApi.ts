import { familyPath, type FamilyLibrariesDto } from "@tentacle-tv/shared";
import { tentacleApiFetch } from "../hooks/usePreferences";

/**
 * Les bibliothèques qu'une famille permet à un invité ou à un membre mineur
 * (serveur 1.30.0, capacité `family.libraryLimits`) — portées par la session
 * COURANTE, avec les droits de son contrôle parental. C'est Jellyfin qui
 * applique, jamais plus large que le plafond du profil. Contrat :
 * `@tentacle-tv/shared` › `family/familyLibraries.ts`.
 */

export function fetchFamilyLibraries(userId: string): Promise<FamilyLibrariesDto> {
  return tentacleApiFetch<FamilyLibrariesDto>(familyPath("profileLibraries", { userId }));
}

/** La liste ENTIÈRE ; null : plus de restriction familiale. */
export function setFamilyLibraries(input: { userId: string; allowed: string[] | null }): Promise<FamilyLibrariesDto> {
  return tentacleApiFetch<FamilyLibrariesDto>(familyPath("setProfileLibraries", { userId: input.userId }), {
    method: "PUT",
    body: JSON.stringify({ allowed: input.allowed }),
  });
}
