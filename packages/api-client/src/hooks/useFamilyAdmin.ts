import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FamilySwitches } from "@tentacle-tv/shared";
import { fetchFamilySwitches, setFamilySwitches } from "../family/familyAdminApi";
import { FAMILY_KEY } from "./useFamily";

/** Les interrupteurs de la Famille (administration). Sous `["family"]` : un
 *  geste de la Famille les relit aussi, et `/api/config` change avec eux. */
export const FAMILY_SWITCHES_KEY = ["family", "admin-switches"] as const;

export function useFamilySwitches(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: FAMILY_SWITCHES_KEY,
    queryFn: fetchFamilySwitches,
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  });
}

/** Pose un interrupteur : la réponse du serveur fait foi (l'état affiché la
 *  reprend), puis la Famille et la configuration se relisent. */
export function useSetFamilySwitches() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<FamilySwitches>) => setFamilySwitches(patch),
    onSuccess: (switches) => qc.setQueryData(FAMILY_SWITCHES_KEY, switches),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [...FAMILY_KEY] });
      void qc.invalidateQueries({ queryKey: ["app-config"] });
    },
  });
}
