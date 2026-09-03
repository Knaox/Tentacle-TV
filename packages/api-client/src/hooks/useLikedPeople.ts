import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tentacleApiFetch } from "./usePreferences";
import { invalidateRecoQueries } from "./useRecoPage";

export interface LikedPerson {
  personId: number;
  name: string;
  profilePath: string | null;
}

export interface PersonSearchResult {
  personId: number;
  name: string;
  profilePath: string | null;
  knownFor: string[];
}

/** Les personnes aimées du compte — matière des rangées « Avec {acteur} ». */
export function useLikedPeople() {
  return useQuery({
    queryKey: ["reco", "people"],
    queryFn: () => tentacleApiFetch<{ people: LikedPerson[] }>("/api/reco/people"),
    staleTime: 5 * 60_000,
  });
}

/**
 * Aimer une personne — par id TMDB (réglages) ou par NOM seul (casting
 * Jellyfin : le serveur résout). L'invalidation de ["reco"] fait naître la
 * rangée « Avec {acteur} » dès la régénération déclenchée côté serveur.
 */
export function useLikePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { personId?: number; name: string; profilePath?: string | null }) =>
      tentacleApiFetch<{ ok: boolean; personId: number; name: string }>("/api/reco/people", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSettled: () => invalidateRecoQueries(qc),
  });
}

/** Ne plus aimer — retrait optimiste de la liste, mêmes invalidations. */
export function useUnlikePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (personId: number) =>
      tentacleApiFetch<{ ok: boolean }>(`/api/reco/people/${personId}`, { method: "DELETE" }),
    onMutate: async (personId) => {
      await qc.cancelQueries({ queryKey: ["reco", "people"] });
      qc.setQueryData<{ people: LikedPerson[] }>(["reco", "people"], (old) =>
        old ? { ...old, people: old.people.filter((p) => p.personId !== personId) } : old
      );
    },
    onSettled: () => invalidateRecoQueries(qc),
  });
}

/** Des acteurs CONNUS pour amorcer la liste (personnes aimées exclues). */
export function usePersonSuggestions() {
  return useQuery({
    queryKey: ["reco", "people-suggestions"],
    queryFn: () =>
      tentacleApiFetch<{ results: PersonSearchResult[] }>("/api/reco/people/suggestions"),
    staleTime: 30 * 60_000,
  });
}

/** Recherche de personne TMDB — l'appelant débounce la saisie. */
export function usePersonSearch(query: string) {
  return useQuery({
    queryKey: ["reco", "people-search", query],
    queryFn: () =>
      tentacleApiFetch<{ results: PersonSearchResult[] }>(
        `/api/reco/people/search?query=${encodeURIComponent(query)}`
      ),
    enabled: query.trim().length >= 2,
    staleTime: 5 * 60_000,
  });
}
