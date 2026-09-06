import { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import { useAuth, useTentacleConfig } from "@tentacle-tv/api-client";
import { OfflineBanner } from "@/components/OfflineBanner";
import { clearCredentials } from "@/auth/credentialManager";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { probeNow } from "./connectivityStore";
import { useConnectivity } from "./useConnectivity";
import { useHasLocalContent } from "./useOfflineMode";

/** L'essai manuel se montre au moins ce temps : un échec instantané (réseau
 *  coupé) ferait sinon clignoter le bouton sans qu'on voie qu'un test a eu lieu. */
const RETRY_MIN_VISIBLE_MS = 600;

/**
 * Le voile plein écran du hors ligne : serveur injoignable CONFIRMÉ par
 * l'hystérésis, et rien à montrer à la place (aucun titre sur l'appareil,
 * pas de mode manuel). Nécessite AppProviders.
 */
export function OfflineOverlays() {
  const { state } = useConnectivity();
  const hasLocalContent = useHasLocalContent();
  const [isChecking, setIsChecking] = useState(false);
  const { logout, changeServer } = useAuth();
  const { storage } = useTentacleConfig();
  const { setServerUrl } = useServerUrl();
  const router = useRouter();

  const retry = useCallback(async () => {
    setIsChecking(true);
    try {
      await Promise.all([
        probeNow(true),
        new Promise((resolve) => setTimeout(resolve, RETRY_MIN_VISIBLE_MS)),
      ]);
    } finally {
      setIsChecking(false);
    }
  }, []);

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

  return (
    <OfflineBanner
      visible={state === "offline-auto" && !hasLocalContent}
      isChecking={isChecking}
      onRetry={retry}
      onLogout={handleLogout}
      onChangeServer={handleChangeServer}
    />
  );
}
