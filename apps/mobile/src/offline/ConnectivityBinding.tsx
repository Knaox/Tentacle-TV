import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { useStorageReady } from "@/providers/StorageReadyContext";
import {
  configureConnectivity,
  reportPossibleOutage,
  startConnectivityListeners,
} from "./connectivityStore";

/** Une requête applicative a-t-elle échoué « façon réseau » (coupure, délai, 5xx) ? */
function looksLikeOutage(error: unknown): boolean {
  if (error instanceof Error) {
    if (error.message === "Network request failed" || error.message === "RequestTimeout") return true;
  }
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" && status >= 500;
}

/**
 * Branche le magasin de connectivité sur l'application : l'URL du serveur et
 * le stockage (mode manuel), les signaux du téléphone, et les échecs des
 * requêtes et mutations React Query — chacun déclenche une sonde, throttlée
 * par le magasin. Ne rend rien ; nécessite AppProviders.
 */
export function ConnectivityBinding() {
  const { serverUrl } = useServerUrl();
  const { storage } = useTentacleConfig();
  const queryClient = useQueryClient();
  const storageReady = useStorageReady();

  // Après l'hydratation seulement : le mode manuel se lit dans le stockage,
  // et avant elle le cache est vide — « Passer hors ligne » se perdait à
  // chaque redémarrage.
  useEffect(() => {
    if (!storageReady) return;
    configureConnectivity({ serverUrl, storage });
  }, [serverUrl, storage, storageReady]);

  useEffect(() => startConnectivityListeners(), []);

  useEffect(() => {
    const unsubscribeQueries = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "error" && looksLikeOutage(event.action.error)) {
        reportPossibleOutage();
      }
    });
    const unsubscribeMutations = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "error" && looksLikeOutage(event.action.error)) {
        reportPossibleOutage();
      }
    });
    return () => {
      unsubscribeQueries();
      unsubscribeMutations();
    };
  }, [queryClient]);

  return null;
}
