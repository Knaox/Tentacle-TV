import { useQuery } from "@tanstack/react-query";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import type { FamilyCapability } from "@tentacle-tv/shared";
import { fetchFamilyCapability } from "../../auth/profileEnrollment";

/**
 * Ce que le serveur annonce de la Famille (`/api/config` › `features.family`)
 * — « Gérer les profils » y lit si le droit d'invité « peut demander »
 * existe (`guestRequests`). Muet ou d'avant la Famille : null.
 */
export function useFamilyCapability(enabled: boolean): FamilyCapability | null {
  const { storage } = useTentacleConfig();
  const serverUrl = storage.getItem("tentacle_server_url");
  const { data } = useQuery({
    queryKey: ["family-capability", serverUrl],
    queryFn: async () => {
      const capability = serverUrl ? await fetchFamilyCapability(serverUrl) : null;
      return capability === "unreachable" ? null : capability;
    },
    enabled: enabled && !!serverUrl,
    staleTime: 10 * 60_000,
  });
  return data ?? null;
}
