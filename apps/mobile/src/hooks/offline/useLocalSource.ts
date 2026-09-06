import { useQuery } from "@tanstack/react-query";
import { useUserId } from "@tentacle-tv/api-client";
import { LOCAL_QUERY } from "@tentacle-tv/offline-core/react";
import { localSourceForItem } from "@/offline/engineApi";

export const LOCAL_SOURCE_QUERY_KEY = "local-source";

/**
 * La source LOCALE d'un titre, revérifiée sur le disque à chaque lecture
 * (`staleTime 0`, remontage forcé) : un fichier retiré entre deux ouvertures
 * renvoie au flux serveur sans écran d'erreur. `waiting` tant que la réponse
 * n'est pas là — le lecteur ne doit pas partir vers le serveur avant.
 */
export function useLocalSource(itemId: string | undefined) {
  const userId = useUserId();
  const enabled = userId !== null && itemId !== undefined;
  const query = useQuery({
    queryKey: [LOCAL_SOURCE_QUERY_KEY, userId, itemId],
    queryFn: () => localSourceForItem(userId as string, itemId as string),
    enabled,
    staleTime: 0,
    gcTime: 5_000,
    refetchOnMount: "always",
    ...LOCAL_QUERY,
  });
  // Démarrage à froid par un lien profond : la route se monte AVANT
  // l'hydratation du stockage (pas encore de compte) — on attend, sinon le
  // lecteur serveur partirait pour un titre présent sur l'appareil.
  const waiting = itemId !== undefined && (userId === null || !query.isFetched);
  return { localSource: query.data ?? null, waiting, refetch: query.refetch };
}
