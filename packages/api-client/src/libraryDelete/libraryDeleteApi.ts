/**
 * Les appels de la suppression de titres (capacité `library.delete`) — contrat :
 * `@tentacle-tv/shared` › `libraryDelete/libraryDeleteContract.ts`.
 */

import { useQuery } from "@tanstack/react-query";
import {
  LIBRARY_DELETE_ROUTES,
  NO_LIBRARY_DELETION,
  type LibraryDeleteResponse,
  type LibraryDeletionRightsDto,
} from "@tentacle-tv/shared";
import { tentacleApiFetch } from "../hooks/usePreferences";
import { useServerCapability } from "../hooks/useServerCapabilities";
import { useUserId } from "../hooks/useUserId";
import { mayShow } from "../rights/accountAbilitiesGate";
import { useAccountAbilities } from "../rights/useAccountAbilities";

export const LIBRARY_DELETION_RIGHTS_KEY = "library-deletion-rights";

export function fetchLibraryDeletionRights(): Promise<LibraryDeletionRightsDto> {
  return tentacleApiFetch<LibraryDeletionRightsDto>(LIBRARY_DELETE_ROUTES.rights.path);
}

export function postLibraryDeletion(ids: readonly string[]): Promise<LibraryDeleteResponse> {
  return tentacleApiFetch<LibraryDeleteResponse>(LIBRARY_DELETE_ROUTES.delete.path, {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

/**
 * Où ce compte peut supprimer — lu par le serveur dans SA politique Jellyfin.
 * Rien tant que le serveur ne déclare pas `library.delete` : un serveur d'avant
 * ne montre aucune case, aucun menu. « Nulle part » pour une TV, un profil ou
 * « voir en tant que » (le serveur le dit, le client n'en décide pas). Bornée
 * aussi par ce que le serveur dit de la SESSION (`account.abilities`, relue à
 * `rights:changed`) : sans `deleteTitles`, nulle part.
 */
export function useLibraryDeletionRights() {
  const supported = useServerCapability("library.delete");
  const userId = useUserId();
  const sessionMay = mayShow(useAccountAbilities(), "deleteTitles");
  return useQuery({
    queryKey: [LIBRARY_DELETION_RIGHTS_KEY, userId],
    queryFn: fetchLibraryDeletionRights,
    enabled: supported && !!userId,
    select: (rights: LibraryDeletionRightsDto) => (sessionMay ? rights : NO_LIBRARY_DELETION),
    // Un droit retiré dans Jellyfin se voit à la minute ; Jellyfin rejuge de toute façon chaque titre.
    staleTime: 60_000,
  });
}
