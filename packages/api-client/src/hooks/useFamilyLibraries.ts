import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchFamilyLibraries, setFamilyLibraries } from "../family/familyLibrariesApi";
import { FAMILY_KEY } from "./useFamily";

export const familyLibrariesKey = (userId: string) => ["family", "libraries", userId] as const;

/** Les bibliothèques d'un profil de la famille, lues à la demande (le dialogue ouvert). */
export function useFamilyLibraries(userId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: familyLibrariesKey(userId),
    queryFn: () => fetchFamilyLibraries(userId),
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  });
}

/** Enregistre la liste : la réponse du serveur prend sa place, la Famille se relit. */
export function useSetFamilyLibraries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: setFamilyLibraries,
    onSuccess: (data, input) => qc.setQueryData(familyLibrariesKey(input.userId), data),
    onSettled: () => void qc.invalidateQueries({ queryKey: [...FAMILY_KEY] }),
  });
}
