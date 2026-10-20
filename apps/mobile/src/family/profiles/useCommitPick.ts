import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { switchWtSession, useTentacleConfig } from "@tentacle-tv/api-client";
import type { PickedProfileDto } from "@tentacle-tv/shared";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { commitMobilePick, type LaunchChoice, type SwitchResult } from "./switchSession";

/** Valider le profil que le serveur vient d'ouvrir : stockage, choix retenu (et celui du démarrage, `launch`), et l'app qui repart si besoin. */
export function useCommitPick(): (picked: PickedProfileDto, launch?: LaunchChoice) => SwitchResult {
  const { storage } = useTentacleConfig();
  const { serverUrl } = useServerUrl();
  const queryClient = useQueryClient();
  return useCallback(
    (picked, launch) => commitMobilePick(picked, { storage, serverUrl: serverUrl ?? "", clearCache: () => queryClient.clear(), followSession: switchWtSession }, launch),
    [storage, serverUrl, queryClient],
  );
}
