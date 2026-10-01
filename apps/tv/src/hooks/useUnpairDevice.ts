import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import { unpairDevice, type UnpairOrigin } from "../auth/unpair";

/** `unpairDevice` depuis un composant : le contexte (client Jellyfin, stockage,
 *  cache des requêtes) est celui de l'arbre. */
export function useUnpairDevice(): (origin: UnpairOrigin) => void {
  const { storage } = useTentacleConfig();
  const queryClient = useQueryClient();
  const jfClient = useJellyfinClient();
  return useCallback(
    (origin: UnpairOrigin) => unpairDevice({ jfClient, storage, queryClient }, origin),
    [jfClient, storage, queryClient],
  );
}
