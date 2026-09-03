import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RecoRowItem, RecoState } from "./recoTypes";
import { dropRecoItemEverywhere, invalidateRecoQueries } from "./useRecoPage";
import { tentacleApiFetch } from "./usePreferences";

// Les types vivent dans recoTypes ; ré-exportés pour les importeurs historiques.
export type { RecoReason, RecoRowItem, RecoState } from "./recoTypes";

export interface RecoOverview {
  state: RecoState;
  signalCount: number;
  generating: boolean;
  /** Quelque chose de mieux arrive (profil ou pool en cours d'affinage). */
  refining?: boolean;
  /** Toute première visite : le profil s'analyse, les rangées servies sont le
   *  meilleur de la bibliothèque (« on explore vos goûts »). */
  exploring?: boolean;
  generatedAt?: string | null;
  /** false : aucune clé TMDB côté serveur — personnalisation indisponible pour
   *  tous, seules les rangées globales sont servies. Absent = vieux serveur. */
  tmdbConfigured?: boolean;
  /** Le réglage brut du compte : false = l'utilisateur a coupé la perso.
   *  Distingue la CAUSE d'un état « disabled » (choix vs clé absente). */
  personalized?: boolean;
  rows: Array<{ key: string; seedTitle?: string }>;
}

export interface RecoRow {
  key: string;
  items: RecoRowItem[];
  seedTitle?: string;
  generatedAt?: string;
  generating?: boolean;
  refining?: boolean;
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
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["reco", "rows"],
    queryFn: () => tentacleApiFetch<RecoOverview>("/api/reco/rows"),
    staleTime: 60_000,
    // Pool ou profil en travail : on repasse dans 5 s, sans marteler.
    refetchInterval: (query) => {
      const d = query.state.data;
      return d && (d.generating || d.refining) ? 5_000 : false;
    },
  });

  // Fin de travail (génération ou affinage) : les rangées déjà en cache —
  // souvent chargées VIDES pendant la génération, staleTime 5 min oblige —
  // doivent se resservir tout de suite. Sans cette invalidation, le héros et
  // « Pour vous » restaient blancs jusqu'à cinq minutes après la fin.
  const busy = query.data ? query.data.generating || query.data.refining === true : false;
  const prevBusy = useRef(busy);
  useEffect(() => {
    if (prevBusy.current && !busy) {
      void qc.invalidateQueries({ queryKey: ["reco", "row"] });
    }
    prevBusy.current = busy;
  }, [busy, qc]);

  return query;
}

/** UNE rangée — dérivée du pool à chaque service, exclusions à jour. */
export function useRecoRow(rowKey: string | null) {
  return useQuery({
    queryKey: ["reco", "row", rowKey],
    queryFn: () =>
      tentacleApiFetch<RecoRow>(`/api/reco/rows/${encodeURIComponent(rowKey ?? "")}`),
    staleTime: 5 * 60_000,
    enabled: !!rowKey,
    // Une rangée servie pendant la génération se re-sonde toute seule : c'est
    // la ceinture de l'accueil, qui ne monte PAS l'overview (et donc ne
    // profite pas de son invalidation de fin de travail).
    refetchInterval: (query) => {
      const d = query.state.data;
      return d && (d.generating || d.pending || d.refining) ? 5_000 : false;
    },
    // Jamais de blanc pendant un refetch de la même rangée.
    placeholderData: (prev) => prev,
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
