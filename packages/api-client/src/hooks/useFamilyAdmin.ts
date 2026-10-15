import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FamilyLaunchPolicy, FamilySwitches, SetFamilyLaunchPolicyBody } from "@tentacle-tv/shared";
import { fetchFamilyLaunchPolicy, fetchFamilySwitches, setFamilyLaunchPolicy, setFamilySwitches } from "../family/familyAdminApi";
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

/** « Qui regarde ? » à l'ouverture réglé par l'administration (serveur `family.pickerPolicy`). */
export const FAMILY_LAUNCH_POLICY_KEY = ["family", "admin-launch-policy"] as const;

export function useFamilyLaunchPolicy(options: { enabled?: boolean } = {}) {
  return useQuery<FamilyLaunchPolicy>({
    queryKey: FAMILY_LAUNCH_POLICY_KEY,
    queryFn: fetchFamilyLaunchPolicy,
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  });
}

/** Pose une règle : la réponse du serveur fait foi, puis la Famille (préférences
 *  comprises) et la configuration se relisent. */
export function useSetFamilyLaunchPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SetFamilyLaunchPolicyBody) => setFamilyLaunchPolicy(patch),
    onSuccess: (policy) => qc.setQueryData(FAMILY_LAUNCH_POLICY_KEY, policy),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [...FAMILY_KEY] });
      void qc.invalidateQueries({ queryKey: ["app-config"] });
    },
  });
}
