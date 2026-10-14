import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerCapability } from "./useServerCapabilities";
import { tentacleApiFetch } from "./usePreferences";

/** Pourquoi une source est en pause : vérification anti-robot, trop de demandes, erreurs en série. */
export type AdminTrailerSourceReason = "bot" | "limit" | "errors";

/** Une source de vidéos vue par l'administration : normale, ou en pause jusqu'à `until` (ms). */
export type AdminTrailerSourceStatus = { state: "normal" } | { state: "paused"; until: number; reason: AdminTrailerSourceReason };

/** Le contrat lu de GET /api/admin/trailers (capacité `trailers.catalog`). */
export interface AdminTrailersStatus {
  /** La case AlloCiné (cochée par défaut). */
  allocine: boolean;
  /** La langue du serveur convient-elle à AlloCiné (le français) ? Sinon la case est grisée. */
  allocineAvailable: boolean;
  /** La langue du serveur (`fr`, `en`…), celle des métadonnées de Jellyfin ; `null` si inconnue. */
  language: string | null;
  sources: { youtube: AdminTrailerSourceStatus; dailymotion: AdminTrailerSourceStatus };
}

export const ADMIN_TRAILERS_KEY = ["admin", "trailers"] as const;

/**
 * Les bandes-annonces vues par un ADMIN (onglet Métadonnées) : la case
 * AlloCiné et l'état des sources. Rien tant que le serveur ne déclare pas
 * `trailers.catalog` (la carte n'existe pas face à un serveur d'avant).
 * Relue toutes les minutes : une pause se lève toute seule.
 */
export function useAdminTrailers(options: { enabled: boolean }) {
  const capable = useServerCapability("trailers.catalog");
  return useQuery({
    queryKey: ADMIN_TRAILERS_KEY,
    queryFn: () => tentacleApiFetch<AdminTrailersStatus>("/api/admin/trailers"),
    enabled: options.enabled && capable,
    staleTime: 0,
    retry: 1,
    refetchInterval: 60_000,
  });
}

/** PUT /api/admin/trailers — la case AlloCiné. L'état affiché est celui que le serveur relit. */
export function useUpdateAdminTrailers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (update: { allocine: boolean }) =>
      tentacleApiFetch<{ ok: true }>("/api/admin/trailers", { method: "PUT", body: JSON.stringify(update) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ADMIN_TRAILERS_KEY }),
  });
}
