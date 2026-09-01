import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tentacleApiFetch } from "./usePreferences";

export type RecoState = "disabled" | "cold" | "warming" | "ready";

export interface RecoReason {
  kind: "facet" | "seed" | "exploration";
  key?: string;
  label?: string;
  seedTitle?: string;
}

export interface RecoRowItem {
  key: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  /** null = hors bibliothèque : badge + navigation vers la fiche Vigie. */
  jellyfinItemId: string | null;
  source: string;
  score: number;
  voteAverage: number | null;
  reasons: RecoReason[];
  exploration?: boolean;
}

export interface RecoOverview {
  state: RecoState;
  signalCount: number;
  generating: boolean;
  generatedAt?: string | null;
  rows: Array<{ key: string; seedTitle?: string }>;
}

export interface RecoRow {
  key: string;
  items: RecoRowItem[];
  seedTitle?: string;
  generatedAt?: string;
  generating?: boolean;
  pending?: boolean;
  state?: RecoState;
}

export type RecoFeedbackAction = "dismissed" | "not_interested" | "already_seen";

export interface ColdStartTitle {
  jellyfinItemId: string;
  name: string;
  year: number | null;
  mediaType: "movie" | "tv";
  tmdbId: number;
}

/** L'état du moteur + la liste ordonnée des rangées disponibles. */
export function useRecoOverview() {
  return useQuery({
    queryKey: ["reco", "rows"],
    queryFn: () => tentacleApiFetch<RecoOverview>("/api/reco/rows"),
    staleTime: 60_000,
    // Pool en cours de génération : on repasse dans 5 s, sans marteler.
    refetchInterval: (query) => (query.state.data?.generating ? 5_000 : false),
  });
}

/** UNE rangée — dérivée du pool à chaque service, exclusions à jour. */
export function useRecoRow(rowKey: string | null) {
  return useQuery({
    queryKey: ["reco", "row", rowKey],
    queryFn: () =>
      tentacleApiFetch<RecoRow>(`/api/reco/rows/${encodeURIComponent(rowKey ?? "")}`),
    staleTime: 5 * 60_000,
    enabled: !!rowKey,
  });
}

/** « Ne plus me proposer » — retrait optimiste de toutes les rangées chargées. */
export function useSendRecoFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { itemKey: string; action: RecoFeedbackAction }) =>
      tentacleApiFetch<{ id: string }>("/api/reco/feedback", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onMutate: async ({ itemKey }) => {
      await qc.cancelQueries({ queryKey: ["reco", "row"] });
      qc.setQueriesData<RecoRow>({ queryKey: ["reco", "row"] }, (old) =>
        old ? { ...old, items: old.items.filter((i) => i.key !== itemKey) } : old
      );
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["reco"] });
    },
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
