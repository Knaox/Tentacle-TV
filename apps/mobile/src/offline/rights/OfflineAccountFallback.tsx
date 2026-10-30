import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { offlineOwnerOf, offlineSessionFallback } from "@tentacle-tv/offline-core";
import { returnToAccountOffline } from "@/family/profiles/switchSession";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { modeHomePath } from "@/octave/mode/octaveModeStore";
import { setManualOffline } from "../connectivityStore";
import { useConnectivity } from "../useConnectivity";
import { clearAccountFallbackNotice, noteAccountFallback } from "./accountFallbackNotice";
import { useOfflineProfileSession } from "./useOfflineOwner";

/**
 * Le hors ligne appartient au compte de l'appareil : plus de connexion pendant
 * la session d'un PROFIL (membre ou invité) → l'app revient d'elle-même au
 * compte (aucun code PIN ne se vérifie sans serveur), l'accueil devient son
 * catalogue local, et le message de passage hors ligne le dit
 * (`accountFallbackNotice`). Le hors ligne MANUEL n'existe pas pour un profil.
 * Au retour du réseau, rien n'est rouvert d'office. L'accueil rendu est celui du
 * MODE en cours (Octave reste Octave : `modeHomePath`). Règle : `offline-core` ›
 * `offlineSessionFallback`. Ne rend rien ; monté une fois dans `OfflineShell`.
 */
export function OfflineAccountFallback() {
  const { storage } = useTentacleConfig();
  const { serverUrl } = useServerUrl();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { state } = useConnectivity();
  const profileSession = useOfflineProfileSession();
  const fallback = offlineSessionFallback({
    profileSession,
    connectivity: state,
    accountRestorable: offlineOwnerOf(storage)?.token != null,
  });

  useEffect(() => {
    if (fallback === "cancelManual") {
      setManualOffline(false);
      return;
    }
    if (fallback !== "returnToAccount") return;
    const name = returnToAccountOffline({ storage, serverUrl: serverUrl ?? "", clearCache: () => queryClient.clear() });
    if (name === null) return;
    noteAccountFallback(name);
    if (router.canDismiss()) router.dismissAll();
    router.replace(modeHomePath() as never);
  }, [fallback, storage, serverUrl, queryClient, router]);

  // Le réseau revenu : la ligne n'a plus rien à dire.
  useEffect(() => {
    if (state === "online") clearAccountFallbackNotice();
  }, [state]);

  return null;
}
