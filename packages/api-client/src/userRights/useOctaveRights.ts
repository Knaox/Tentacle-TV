import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { octaveRightsPath, type OctaveAccountRightsDto, type SetOctaveAccountRightsBody } from "@tentacle-tv/shared";
import { tentacleApiFetch } from "../hooks/usePreferences";

/**
 * « Accès à Octave » d'un compte, par l'administration (web et bureau ;
 * capacité `octave.rights`, `requirePersonalAdmin`). Un droit TENTACLE : gardé
 * par le serveur, jamais dans la politique Jellyfin. Clé :
 * `["admin-user-rights", "octave", id]` — sous `USER_RIGHTS_KEY`, relue avec
 * le reste de la fiche.
 */

export const octaveRightsKey = (userId: string) => ["admin-user-rights", "octave", userId.replace(/-/g, "").toLowerCase()] as const;

export function fetchOctaveRights(userId: string): Promise<OctaveAccountRightsDto> {
  return tentacleApiFetch<OctaveAccountRightsDto>(octaveRightsPath("read", userId));
}

export function setOctaveRights(input: { userId: string; rights: SetOctaveAccountRightsBody }): Promise<OctaveAccountRightsDto> {
  return tentacleApiFetch<OctaveAccountRightsDto>(octaveRightsPath("update", input.userId), {
    method: "PUT",
    body: JSON.stringify(input.rights),
  });
}

export function useOctaveRights(userId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: octaveRightsKey(userId),
    queryFn: () => fetchOctaveRights(userId),
    enabled: (options.enabled ?? true) && userId !== "",
    staleTime: 15_000,
    retry: 1,
  });
}

export function useSetOctaveRights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: setOctaveRights,
    onSuccess: (dto) => qc.setQueryData(octaveRightsKey(dto.userId), dto),
    onError: (_error, { userId }) => void qc.invalidateQueries({ queryKey: octaveRightsKey(userId) }),
  });
}
