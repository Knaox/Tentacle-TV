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
} from "@tentacle-tv/api-client";
import { setSessionExpired } from "@/auth/sessionState";
import type { StorageAdapter, UuidGenerator } from "@tentacle-tv/api-client";

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

  // Handle auth expiration: redirect to login but keep token in storage
  // so the app can try to auto-reconnect on next restart.
  // Token is only cleared from storage on explicit logout.
  useEffect(() => {
    client.setOnAuthExpired(() => {
      console.debug("[AppProviders] Auth expired — redirecting to login (token kept in storage)");
      setSessionExpired(true);
      setPreferencesToken(null);
      queryClient.clear();
      router.replace("/(auth)/login");
    });
  }, [client, storage, router]);

  useEffect(() => {
    if (!serverUrl) return;
    client.setBaseUrl(`${serverUrl}/api/jellyfin`);
    setPreferencesBackendUrl(serverUrl);
    setConfigBackendUrl(serverUrl);
    setStreamingConfigBackendUrl(serverUrl);
    setNotificationsBackendUrl(serverUrl);
    setTicketsBackendUrl(serverUrl);
    setPairingBackendUrl(serverUrl);

    const token = storage.getItem("tentacle_token");
    if (token) {
      client.setAccessToken(token);
      setPreferencesToken(token);
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
