import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tentacleApiFetch } from "./usePreferences";

export interface ExternalAccountsStatus {
  tmdb: { configured: boolean; linked: boolean; linkedAt: string | null };
  sync: { pending: number; failed: number; synced: number };
}

/** État des comptes liés + santé de la file de sync des notes. */
export function useExternalAccounts() {
  return useQuery({
    queryKey: ["external-accounts"],
    queryFn: () => tentacleApiFetch<ExternalAccountsStatus>("/api/external/accounts"),
    staleTime: 30_000,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["external-accounts"] });
}

export function useCreateTmdbGuestSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      tentacleApiFetch<{ guestSessionId: string }>("/api/external/tmdb/guest-session", {
        method: "POST",
      }),
    onSettled: () => invalidate(qc),
  });
}

export function useUnlinkTmdbGuestSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      tentacleApiFetch<{ ok: boolean }>("/api/external/tmdb/guest-session", { method: "DELETE" }),
    onSettled: () => invalidate(qc),
  });
}

/** Rejoue les syncs en échec (et réévalue les « disabled »). */
export function useResyncRatings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      tentacleApiFetch<{ requeued: number }>("/api/external/resync", { method: "POST" }),
    onSettled: () => {
      invalidate(qc);
      void qc.invalidateQueries({ queryKey: ["ratings"] });
    },
  });
}
