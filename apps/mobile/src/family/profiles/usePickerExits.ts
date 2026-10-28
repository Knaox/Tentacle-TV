import { useCallback, useMemo } from "react";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { pickerUnreachableExits } from "@tentacle-tv/offline-core";
import { useOfflineList } from "@/hooks/offline/useOfflineList";
import { setManualOffline } from "@/offline/connectivityStore";
import { noteAccountFallback } from "@/offline/rights/accountFallbackNotice";
import { useAccountKeepRight } from "@/offline/rights/useOfflineOwner";
import { useOfflineVeilActions } from "@/offline/useOfflineVeilActions";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { useAccountUserId } from "./profileSessionState";
import { clearProfilePickerRequest } from "./sessionEpoch";
import { returnToAccountOffline } from "./switchSession";

export interface MobilePickerExits {
  /** null : rien de gardé par le compte ici, ou droit refusé. */
  goOffline: (() => void) | null;
  signOut: () => void;
  changeServer: () => void;
}

/**
 * « Qui regarde ? » sans serveur, sur le mobile — l'adaptateur des sorties (`pickerUnreachableExits`,
 * offline-core) : ce que le COMPTE de l'appareil garde ici (la liste locale, lue seulement quand le serveur ne
 * répond pas), son droit retenu, puis les gestes — les MÊMES que les voiles du hors ligne
 * (`useOfflineVeilActions` : se déconnecter, changer de serveur).
 *
 * « Continuer hors ligne » : le hors ligne MANUEL, au nom du compte — une session de profil gardée y revient
 * d'abord (`returnToAccountOffline`, comme quand la connexion tombe pendant un profil : le hors ligne MANUEL
 * n'existe pas pour un profil), puis `onLeave` referme l'écran.
 */
export function usePickerExits(active: boolean, onLeave: () => void): MobilePickerExits | undefined {
  const { storage } = useTentacleConfig();
  const { serverUrl } = useServerUrl();
  const queryClient = useQueryClient();
  const router = useRouter();
  const accountId = useAccountUserId();
  const keepRight = useAccountKeepRight();
  const { data } = useOfflineList(active ? accountId : null);
  const { handleLogout, handleChangeServer } = useOfflineVeilActions();
  const hasContent = data === undefined ? null : data.some((entry) => entry.status === "complete");

  const goOffline = useCallback(() => {
    const name = returnToAccountOffline({ storage, serverUrl: serverUrl ?? "", clearCache: () => queryClient.clear() });
    if (name !== null) noteAccountFallback(name);
    clearProfilePickerRequest();
    setManualOffline(true);
    onLeave();
    router.replace("/(tabs)" as never);
  }, [storage, serverUrl, queryClient, onLeave, router]);

  return useMemo(() => {
    if (!active) return undefined;
    const rule = pickerUnreachableExits({ offlineSupported: true, keepRight, hasContent });
    return { goOffline: rule.goOffline ? goOffline : null, signOut: handleLogout, changeServer: handleChangeServer };
  }, [active, keepRight, hasContent, goOffline, handleLogout, handleChangeServer]);
}
