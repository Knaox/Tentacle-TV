import { useCallback } from "react";
import { useRouter } from "expo-router";
import { useAuth, useTentacleConfig } from "@tentacle-tv/api-client";
import { clearCredentials } from "@/auth/credentialManager";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { setManualOffline } from "./connectivityStore";
import { useProbeRetry } from "./useProbeRetry";
import { endAccountProfiles } from "@/family/profiles/accountLogout";

/**
 * Les gestes communs aux voiles du hors ligne — serveur injoignable, session
 * expirée : réessayer (sonde forcée), se déconnecter (purge locale même sans
 * serveur), changer de serveur — et passer hors ligne à la main, qui ne se
 * quitte qu'à la main (carte « Repasser en ligne »).
 */
export function useOfflineVeilActions() {
  const { isChecking, retry } = useProbeRetry();
  const { logout, changeServer } = useAuth();
  const { storage } = useTentacleConfig();
  const { setServerUrl } = useServerUrl();
  const router = useRouter();

  const handleLogout = useCallback(() => {
    // Hors ligne, le serveur ne répond pas : la session de profil (Famille) s'oublie quand même.
    void endAccountProfiles(storage, storage.getItem("tentacle_server_url")).finally(() => logout.mutate(undefined, {
      onSuccess: () => {
        clearCredentials(storage);
        router.replace("/(auth)/login");
      },
      onError: () => {
        storage.removeItem("tentacle_token");
        storage.removeItem("tentacle_user");
        clearCredentials(storage);
        router.replace("/(auth)/login");
      },
    }));
  }, [logout, storage, router]);

  const handleChangeServer = useCallback(() => {
    changeServer.mutate(undefined, {
      onSettled: () => {
        setServerUrl(null);
        router.replace("/(auth)/server-setup");
      },
    });
  }, [changeServer, router, setServerUrl]);

  const goOffline = useCallback(() => setManualOffline(true), []);

  return { isChecking, retry, handleLogout, handleChangeServer, goOffline };
}
