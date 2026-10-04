import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptFamilyInvitation,
  cancelFamilyInvitation,
  createFamilyGuest,
  declineFamilyInvitation,
  deleteFamilyGuest,
  dissolveFamily,
  fetchFamilyCandidates,
  fetchFamilyOverview,
  leaveFamily,
  removeFamilyMember,
  sendFamilyInvitation,
  setFamilyGuestPin,
  setFamilyMemberRights,
  setOwnFamilyPin,
  snoozeFamilyInvitation,
} from "../family/familyApi";

/**
 * La Famille en crochets react-query — mêmes clés pour le web, le bureau, le
 * mobile et la gestion des profils de l'Apple TV (API commune v4 / v5 : la
 * TV tourne en v4). Tout geste relit `["family"]` en se terminant ; le
 * serveur prévient les AUTRES appareils par `family:update` (`useFamilyLive`).
 */

export const FAMILY_KEY = ["family"] as const;
export const FAMILY_OVERVIEW_KEY = ["family", "overview"] as const;
export const familyCandidatesKey = (query: string) => ["family", "candidates", query.trim()] as const;

const OVERVIEW_STALE_TIME = 60_000;

/** L'état de la Famille. À n'activer que si le serveur l'annonce
 *  (`useAppConfig` › `features.family`) ; null face à un serveur d'avant. */
export function useFamilyOverview(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: FAMILY_OVERVIEW_KEY,
    queryFn: fetchFamilyOverview,
    enabled: options.enabled ?? true,
    staleTime: OVERVIEW_STALE_TIME,
  });
}

/** Les candidats (v2 : tous les comptes, cachés compris, marqués `in_family` / `invited` ; `query` affine). */
export function useFamilyCandidates(query: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: familyCandidatesKey(query),
    queryFn: () => fetchFamilyCandidates(query),
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  });
}

/** Un geste de la Famille : relit la Famille (et `extra`) quoi qu'il arrive. */
function useFamilyMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  extra: readonly (readonly string[])[] = [],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [...FAMILY_KEY] });
      for (const key of extra) void qc.invalidateQueries({ queryKey: [...key] });
    },
  });
}

/** Une invitation répondue quitte aussi la cloche. */
const BELL = [["notifications"]] as const;

export function useCreateFamilyGuest() {
  return useFamilyMutation(createFamilyGuest);
}

/** Supprime le compte Jellyfin de l'invité : confirmer d'abord (sa lecture est perdue). */
export function useDeleteFamilyGuest() {
  return useFamilyMutation(deleteFamilyGuest);
}

export function useSetFamilyGuestPin() {
  return useFamilyMutation(setFamilyGuestPin);
}

export function useSetOwnFamilyPin() {
  return useFamilyMutation(setOwnFamilyPin);
}

export function useRemoveFamilyMember() {
  return useFamilyMutation(removeFamilyMember);
}

/** Le propriétaire permet (ou retire) à un membre de créer des invités — retirer ne supprime rien. */
export function useSetFamilyMemberRights() {
  return useFamilyMutation(setFamilyMemberRights);
}

export function useSendFamilyInvitation() {
  return useFamilyMutation(sendFamilyInvitation);
}

export function useCancelFamilyInvitation() {
  return useFamilyMutation(cancelFamilyInvitation);
}

export function useAcceptFamilyInvitation() {
  return useFamilyMutation(acceptFamilyInvitation, BELL);
}

export function useDeclineFamilyInvitation() {
  return useFamilyMutation(declineFamilyInvitation, BELL);
}

export function useSnoozeFamilyInvitation() {
  return useFamilyMutation(snoozeFamilyInvitation);
}

export function useLeaveFamily() {
  return useFamilyMutation(leaveFamily, BELL);
}

/** Membres sortis, invités supprimés : confirmer explicitement d'abord. */
export function useDissolveFamily() {
  return useFamilyMutation(dissolveFamily);
}
