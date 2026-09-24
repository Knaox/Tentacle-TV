import { useEffect } from "react";
import { AppState } from "react-native";
import type { QueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  setPreferencesToken,
  setPairingToken,
  setPushToken,
  setShareLinkToken,
  type JellyfinClient,
  type StorageAdapter,
} from "@tentacle-tv/api-client";
import { setSessionExpired } from "@/auth/sessionState";
import { attemptReAuth, loginIdentity } from "@/auth/credentialManager";

/** Équivalent d'AbortSignal.timeout(), que React Native ne fournit pas */
function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

/** Verrou : l'expiration signalée par le client et le retour au premier plan
 *  ne rafraîchissent jamais la session en même temps. */
let isRefreshing = false;

interface AuthRefreshOptions {
  client: JellyfinClient;
  storage: StorageAdapter;
  serverUrl: string | null;
  /** Passé tel quel : le hook tourne dans AppProviders, AU-DESSUS du
   *  QueryClientProvider, où useQueryClient() n'aurait rien à lire. */
  queryClient: QueryClient;
}

/**
 * Garde la session Tentacle en vie : le jeton est rafraîchi quand le client le
 * signale expiré et quand l'app revient au premier plan. Un 401 tente d'abord
 * une reconnexion par les identifiants mémorisés ; une erreur serveur ou réseau
 * laisse la session en place.
 */
export function useAuthRefresh({ client, storage, serverUrl, queryClient }: AuthRefreshOptions) {
  const router = useRouter();

  // Jeton expiré, signalé par le client : tenter un rafraîchissement avant de déconnecter
  useEffect(() => {
    client.setOnAuthExpired(async () => {
      if (isRefreshing) return;
      isRefreshing = true;
      try {
        const token = storage.getItem("tentacle_token");
        if (!token || !serverUrl) {
          setSessionExpired(true);
          setPreferencesToken(null);
          setShareLinkToken(null); setPairingToken(null); setPushToken(null);
          client.setAccessToken(null);
          queryClient.clear();
          router.replace("/(auth)/login");
          return;
        }

        try {
          const res = await fetch(`${serverUrl}/api/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
            signal: timeoutSignal(8000),
          });

          if (res.ok) {
            const data = await res.json();
            client.setAccessToken(data.AccessToken);
            setPreferencesToken(data.AccessToken);
            setShareLinkToken(data.AccessToken); setPairingToken(data.AccessToken); setPushToken(data.AccessToken);
            client.resetAuthState();
            queryClient.invalidateQueries();
            return;
          }

          if (res.status === 401) {
            const reAuth = await attemptReAuth(storage, serverUrl, loginIdentity(client));
            if (reAuth) {
              client.setAccessToken(reAuth.AccessToken);
              if (reAuth.DeviceId) client.adoptJellyfinDeviceId(reAuth.DeviceId);
              storage.setItem("tentacle_token", reAuth.AccessToken);
              storage.setItem("tentacle_user", JSON.stringify(reAuth.User));
              setPreferencesToken(reAuth.AccessToken);
              setShareLinkToken(reAuth.AccessToken); setPairingToken(reAuth.AccessToken); setPushToken(reAuth.AccessToken);
              client.resetAuthState();
              queryClient.invalidateQueries();
              return;
            }
            storage.removeItem("tentacle_token");
            storage.removeItem("tentacle_user");
            setSessionExpired(true);
            setPreferencesToken(null);
            setShareLinkToken(null); setPairingToken(null); setPushToken(null);
            client.setAccessToken(null);
            queryClient.clear();
            router.replace("/(auth)/login");
            return;
          }

          // Erreur serveur (503…) : on garde le jeton, pas de déconnexion
        } catch {
          // Erreur réseau ou délai dépassé : pas de déconnexion
        }
      } finally {
        isRefreshing = false;
      }
    });
  }, [client, storage, router, serverUrl, queryClient]);

  // Retour au premier plan : revalider le jeton
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (state) => {
      if (state !== "active" || !serverUrl) return;
      if (isRefreshing) return;
      const token = storage.getItem("tentacle_token");
      if (!token) return;

      isRefreshing = true;
      try {
        const res = await fetch(`${serverUrl}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          signal: timeoutSignal(8000),
        });

        if (res.ok) {
          const data = await res.json();
          client.setAccessToken(data.AccessToken);
          setPreferencesToken(data.AccessToken);
          setShareLinkToken(data.AccessToken); setPairingToken(data.AccessToken); setPushToken(data.AccessToken);
          client.resetAuthState();
          queryClient.invalidateQueries();
        } else if (res.status === 401) {
          const reAuth = await attemptReAuth(storage, serverUrl, loginIdentity(client));
          if (reAuth) {
            client.setAccessToken(reAuth.AccessToken);
            if (reAuth.DeviceId) client.adoptJellyfinDeviceId(reAuth.DeviceId);
            storage.setItem("tentacle_token", reAuth.AccessToken);
            storage.setItem("tentacle_user", JSON.stringify(reAuth.User));
            setPreferencesToken(reAuth.AccessToken);
            setShareLinkToken(reAuth.AccessToken); setPairingToken(reAuth.AccessToken); setPushToken(reAuth.AccessToken);
            client.resetAuthState();
            queryClient.invalidateQueries();
          } else {
            storage.removeItem("tentacle_token");
            storage.removeItem("tentacle_user");
            setSessionExpired(true);
            setPreferencesToken(null);
            setShareLinkToken(null); setPairingToken(null); setPushToken(null);
            client.setAccessToken(null);
            queryClient.clear();
            router.replace("/(auth)/login");
          }
        }
        // 503 ou erreur réseau : ignoré, la session reste en place
      } catch {
        // Erreur réseau : la session reste en place
      } finally {
        isRefreshing = false;
      }
    });
    return () => sub.remove();
  }, [client, storage, router, serverUrl, queryClient]);
}
