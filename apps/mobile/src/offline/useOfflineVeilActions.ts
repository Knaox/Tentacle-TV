import { useCallback } from "react";
import { useRouter } from "expo-router";
import { useAuth, useTentacleConfig } from "@tentacle-tv/api-client";
import { clearCredentials } from "@/auth/credentialManager";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { useProbeRetry } from "./useProbeRetry";

/**
 * Les gestes communs aux voiles du hors ligne — serveur injoignable, session
 * expirée : réessayer (sonde forcée), se déconnecter (purge locale même sans
 * serveur), changer de serveur.
 */
export function useOfflineVeilActions() {
  const { isChecking, retry } = useProbeRetry();
  const { logout, changeServer } = useAuth();
  const { storage } = useTentacleConfig();
  const { setServerUrl } = useServerUrl();
  const router = useRouter();

  const handleLogout = useCallback(() => {
    logout.mutate(undefined, {
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
    });
  }, [logout, storage, router]);

  const handleChangeServer = useCallback(() => {
    changeServer.mutate(undefined, {
      onSettled: () => {
        setServerUrl(null);
        router.replace("/(auth)/server-setup");
      },
    });
  }, [changeServer, router, setServerUrl]);

  return { isChecking, retry, handleLogout, handleChangeServer };
}
