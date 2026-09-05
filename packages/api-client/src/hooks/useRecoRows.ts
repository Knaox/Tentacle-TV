import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dropRecoItemEverywhere, invalidateRecoQueries } from "./useRecoPage";
import { tentacleApiFetch } from "./usePreferences";

// Les types vivent dans recoTypes ; ré-exportés pour les importeurs historiques.
// Les anciens hooks par rangée (useRecoOverview, useRecoRow) n'existent plus :
// la page se lit en une requête (useRecoPage).
export type { RecoReason, RecoRowItem, RecoState } from "./recoTypes";

export type RecoFeedbackAction = "dismissed" | "not_interested" | "already_seen";

export interface ColdStartTitle {
  jellyfinItemId: string;
  name: string;
  year: number | null;
  mediaType: "movie" | "tv";
  tmdbId: number;
}

/** « Ne plus me proposer » — retrait optimiste de toutes les pages chargées. */
export function useSendRecoFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { itemKey: string; action: RecoFeedbackAction }) =>
      tentacleApiFetch<{ id: string }>("/api/reco/feedback", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onMutate: ({ itemKey }) => dropRecoItemEverywhere(qc, itemKey),
    onSettled: () => invalidateRecoQueries(qc),
  });
}

/**
 * Sortie volontaire du démarrage à froid : lance la reconstruction du profil
 * — le serveur répond 202 immédiatement et travaille en fond. Les appelants
 * ne doivent PLUS attendre (`mutate`, jamais `mutateAsync`) : la bascule
 * d'écran est instantanée, le poll de l'aperçu suit la fin du travail.
 */
export function useRecoWarmup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      tentacleApiFetch<{ started: boolean }>("/api/reco/profile/rebuild", { method: "POST" }),
    onSettled: () => invalidateRecoQueries(qc),
  });
}

/** Grille de démarrage à froid : des titres de la bibliothèque à noter. */
export function useColdStartTitles(enabled: boolean) {
  return useQuery({
    queryKey: ["reco", "coldstart"],
    queryFn: () => tentacleApiFetch<{ items: ColdStartTitle[] }>("/api/reco/coldstart"),
    staleTime: 10 * 60_000,
    enabled,
  });
}
