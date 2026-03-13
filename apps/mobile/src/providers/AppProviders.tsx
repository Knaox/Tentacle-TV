import React, { useEffect, useMemo } from "react";
import { AppState, Platform } from "react-native";
import { QueryClient, QueryClientProvider, focusManager, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

// Refetch les queries stale quand l'app revient au premier plan
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener("change", (state) => {
    handleFocus(state === "active");
  });
  return () => sub.remove();
});
import {
  TentacleConfigContext,
  JellyfinClientContext,
  JellyfinClient,
  useJellyfinClient,
  useStreamingConfig,
  STREAMING_CONFIG_QUERY_KEY,
  setPreferencesBackendUrl,
  setPreferencesToken,
  setConfigBackendUrl,
  setStreamingConfigBackendUrl,
  setNotificationsBackendUrl,
  setTicketsBackendUrl,
  setPairingBackendUrl,
  setSharedWatchlistsBackendUrl,
  setSharedWatchlistsToken,
} from "@tentacle-tv/api-client";
import { setSessionExpired } from "@/auth/sessionState";
import { attemptReAuth } from "@/auth/credentialManager";
import type { StorageAdapter, UuidGenerator } from "@tentacle-tv/api-client";

/** AbortSignal.timeout() polyfill for React Native */
function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

interface AppProvidersProps {
  storage: StorageAdapter;
  uuid: UuidGenerator;
  serverUrl: string | null;
  children: React.ReactNode;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
    },
  },
});

export function AppProviders({ storage, uuid, serverUrl, children }: AppProvidersProps) {
  const router = useRouter();

  const client = useMemo(() => {
    const jellyfinBase = serverUrl ? `${serverUrl}/api/jellyfin` : "";
    const MOBILE_VERSION: string = require("../../package.json").version ?? "1.0.0";
    const deviceName = Platform.OS === "android" ? "Tentacle-Android" : "Tentacle-iOS";
    const c = new JellyfinClient(jellyfinBase, storage, uuid, deviceName, "Tentacle TV - Mobile", MOBILE_VERSION);
    const token = storage.getItem("tentacle_token");
    if (token) c.setAccessToken(token);
    return c;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUrl]);

  // Handle auth expiration: try to refresh before logging out
  useEffect(() => {
    client.setOnAuthExpired(async () => {
      const token = storage.getItem("tentacle_token");
      if (!token || !serverUrl) {
        setSessionExpired(true);
        setPreferencesToken(null);
        setSharedWatchlistsToken(null);
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
          signal: timeoutSignal(5000),
        });

        if (res.ok) {
          // Token still valid — restore session silently
          const data = await res.json();
          client.setAccessToken(data.AccessToken);
          setPreferencesToken(data.AccessToken);
          setSharedWatchlistsToken(data.AccessToken);
          console.debug("[AppProviders] Token refreshed successfully");
          return;
        }

        if (res.status === 401) {
          // Token truly expired — try re-auth via stored credentials
          console.debug("[AppProviders] Token expired — attempting re-auth");
          const reAuth = await attemptReAuth(storage, serverUrl);
          if (reAuth) {
            client.setAccessToken(reAuth.AccessToken);
            storage.setItem("tentacle_token", reAuth.AccessToken);
            storage.setItem("tentacle_user", JSON.stringify(reAuth.User));
            setPreferencesToken(reAuth.AccessToken);
            setSharedWatchlistsToken(reAuth.AccessToken);
            console.debug("[AppProviders] Re-auth succeeded");
            return;
          }
          // Re-auth failed — redirect to login
          console.debug("[AppProviders] Re-auth failed — redirecting to login");
          storage.removeItem("tentacle_token");
          storage.removeItem("tentacle_user");
          setSessionExpired(true);
          setPreferencesToken(null);
          setSharedWatchlistsToken(null);
          client.setAccessToken(null);
          queryClient.clear();
          router.replace("/(auth)/login");
          return;
        }

        // Server error (503, etc.) — keep token, don't disconnect
        console.debug("[AppProviders] Refresh failed (server unreachable) — keeping session");
      } catch {
        // Network error — don't disconnect
        console.debug("[AppProviders] Refresh failed (network) — keeping session");
      }
    });
  }, [client, storage, router, serverUrl]);

  // Validate token when app returns to foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (state) => {
      if (state !== "active" || !serverUrl) return;
      const token = storage.getItem("tentacle_token");
      if (!token) return;

      try {
        const res = await fetch(`${serverUrl}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          signal: timeoutSignal(5000),
        });

        if (res.ok) {
          const data = await res.json();
          client.setAccessToken(data.AccessToken);
          setPreferencesToken(data.AccessToken);
          setSharedWatchlistsToken(data.AccessToken);
        } else if (res.status === 401) {
          // Try re-auth via stored credentials
          const reAuth = await attemptReAuth(storage, serverUrl);
          if (reAuth) {
            client.setAccessToken(reAuth.AccessToken);
            storage.setItem("tentacle_token", reAuth.AccessToken);
            storage.setItem("tentacle_user", JSON.stringify(reAuth.User));
            setPreferencesToken(reAuth.AccessToken);
            setSharedWatchlistsToken(reAuth.AccessToken);
          } else {
            storage.removeItem("tentacle_token");
            storage.removeItem("tentacle_user");
            setSessionExpired(true);
            setPreferencesToken(null);
            setSharedWatchlistsToken(null);
            client.setAccessToken(null);
            queryClient.clear();
            router.replace("/(auth)/login");
          }
        }
        // 503/network error: silently ignore, keep current session
      } catch {
        // Network error — keep session
      }
    });
    return () => sub.remove();
  }, [client, storage, router, serverUrl]);

  useEffect(() => {
    if (!serverUrl) return;
    client.setBaseUrl(`${serverUrl}/api/jellyfin`);
    setPreferencesBackendUrl(serverUrl);
    setConfigBackendUrl(serverUrl);
    setStreamingConfigBackendUrl(serverUrl);
    setNotificationsBackendUrl(serverUrl);
    setTicketsBackendUrl(serverUrl);
    setPairingBackendUrl(serverUrl);
    setSharedWatchlistsBackendUrl(serverUrl);

    const token = storage.getItem("tentacle_token");
    if (token) {
      client.setAccessToken(token);
      setPreferencesToken(token);
      setSharedWatchlistsToken(token);
    }
  }, [serverUrl, client, storage]);

  const configValue = useMemo(
    () => ({ storage, uuid }),
    [storage, uuid],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TentacleConfigContext.Provider value={configValue}>
        <JellyfinClientContext.Provider value={client}>
          <DirectStreamingSync storage={storage} />
          {children}
        </JellyfinClientContext.Provider>
      </TentacleConfigContext.Provider>
    </QueryClientProvider>
  );
}

/** Sync direct streaming config — same logic as web DirectStreamingSync */
function DirectStreamingSync({ storage }: { storage: StorageAdapter }) {
  const client = useJellyfinClient();
  const qc = useQueryClient();
  const token = storage.getItem("tentacle_token");
  const { data } = useStreamingConfig(token);

  useEffect(() => {
    if (data?.enabled && data.mediaBaseUrl && data.jellyfinToken) {
      client.setDirectStreaming({
        enabled: true,
        mediaBaseUrl: data.mediaBaseUrl,
        jellyfinToken: data.jellyfinToken,
      });
    } else {
      client.setDirectStreaming(null);
    }
  }, [client, data]);

  useEffect(() => {
    client.setOnDirectStreamingFail(() => {
      qc.invalidateQueries({ queryKey: [STREAMING_CONFIG_QUERY_KEY] });
    });
  }, [client, qc]);

  return null;
}
