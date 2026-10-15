import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AccountFamilyRightsDto, FamilyCreationDefaults, SetFamilyCreationDefaultsBody } from "@tentacle-tv/shared";
import {
  fetchAccountFamilyRights,
  fetchFamilyCreationDefaults,
  setAccountFamilyRights,
  setFamilyCreationDefaults,
  setFamilyMemberParental,
  setFamilyMemberRole,
} from "../family/familyRolesApi";
import { FAMILY_KEY } from "./useFamily";

/**
 * Parents, membres mineurs et droits de création en crochets (serveur 1.30.0). Les
 * clés vivent sous `["family"]` : un geste de la Famille les relit, et l'inverse.
 * Le client n'active une requête que si le serveur déclare la capacité.
 */

export const FAMILY_CREATION_DEFAULTS_KEY = ["family", "admin-creation-defaults"] as const;
export const accountFamilyRightsKey = (userId: string) => ["family", "admin-account-rights", userId] as const;

function useFamilyGesture<TVariables, TData>(mutationFn: (variables: TVariables) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn, onSettled: () => void qc.invalidateQueries({ queryKey: [...FAMILY_KEY] }) });
}

/** Nommer un parent (le propriétaire) : la Famille se relit. */
export function useSetFamilyMemberRole() {
  return useFamilyGesture(setFamilyMemberRole);
}

/** Le contrôle parental d'un membre mineur : son état voyage avec le profil (`parental`, `parentalCeiling`). */
export function useSetFamilyMemberParental() {
  return useFamilyGesture(setFamilyMemberParental);
}

export function useFamilyCreationDefaults(options: { enabled?: boolean } = {}) {
  return useQuery<FamilyCreationDefaults>({
    queryKey: FAMILY_CREATION_DEFAULTS_KEY,
    queryFn: fetchFamilyCreationDefaults,
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  });
}

/** La réponse du serveur fait foi ; les fiches des comptes (qui en dépendent) se relisent. */
export function useSetFamilyCreationDefaults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SetFamilyCreationDefaultsBody) => setFamilyCreationDefaults(patch),
    onSuccess: (defaults) => qc.setQueryData(FAMILY_CREATION_DEFAULTS_KEY, defaults),
    onSettled: () => void qc.invalidateQueries({ queryKey: [...FAMILY_KEY] }),
  });
}

export function useAccountFamilyRights(userId: string, options: { enabled?: boolean } = {}) {
  return useQuery<AccountFamilyRightsDto>({
    queryKey: accountFamilyRightsKey(userId),
    queryFn: () => fetchAccountFamilyRights(userId),
    enabled: (options.enabled ?? true) && userId !== "",
    staleTime: 30_000,
  });
}

export function useSetAccountFamilyRights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: setAccountFamilyRights,
    onSuccess: (dto) => qc.setQueryData(accountFamilyRightsKey(dto.userId), dto),
    onError: (_error, { userId }) => void qc.invalidateQueries({ queryKey: accountFamilyRightsKey(userId) }),
  });
}
