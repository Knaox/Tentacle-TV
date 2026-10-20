import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import type { PickedProfileDto } from "@tentacle-tv/shared";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { commitMobilePick, type SwitchResult } from "./switchSession";

/** Valider le profil que le serveur vient d'ouvrir : stockage, choix retenu, et l'app qui repart si besoin. */
export function useCommitPick(): (picked: PickedProfileDto) => SwitchResult {
  const { storage } = useTentacleConfig();
  const { serverUrl } = useServerUrl();
  const queryClient = useQueryClient();
  return useCallback(
    (picked) => commitMobilePick(picked, { storage, serverUrl: serverUrl ?? "", clearCache: () => queryClient.clear() }),
    [storage, serverUrl, queryClient],
  );
}
