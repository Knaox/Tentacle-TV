import { useQuery } from "@tanstack/react-query";
import { tentacleApiFetch } from "./usePreferences";

/** Le contrat lu de GET /api/admin/metadata — la partie qui intéresse les clients. */
export interface AdminMetadataStatus {
  tmdb: {
    configured: boolean;
    source: "env" | "db" | null;
    last4: string | null;
  };
}

export const ADMIN_METADATA_KEY = ["admin", "metadata"] as const;

/**
 * L'état des métadonnées vu par un ADMIN (la route répond 403 aux autres,
 * d'où `enabled`) : la clé TMDB est-elle posée ? Sert aux bandeaux « ajoutez
 * votre clé » du web et du mobile. Cinq minutes de fraîcheur, pas de relance
 * sur échec (un 403 ne se retente pas) ; la page Admin → Métadonnées invalide
 * la clé après une écriture, le bandeau s'efface aussitôt.
 */
export function useAdminMetadataStatus(options: { enabled: boolean }) {
  return useQuery({
    queryKey: ADMIN_METADATA_KEY,
    queryFn: () => tentacleApiFetch<AdminMetadataStatus>("/api/admin/metadata"),
    enabled: options.enabled,
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
