import React, { useEffect, useMemo } from "react";
import { AppState } from "react-native";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
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
  setPreferencesBackendUrl,
  setPreferencesToken,
  setConfigBackendUrl,
  setStreamingConfigBackendUrl,
  setNotificationsBackendUrl,
  setTicketsBackendUrl,
  setPairingBackendUrl,
} from "@tentacle-tv/api-client";
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
    const c = new JellyfinClient(jellyfinBase, storage, uuid, "Tentacle-iOS");
    const token = storage.getItem("tentacle_token");
    if (token) c.setAccessToken(token);
    return c;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUrl]);

  // Handle auth expiration: clear storage and redirect to login
  useEffect(() => {
    client.setOnAuthExpired(() => {
      console.warn("[AppProviders] Auth expired — clearing token, redirecting to login");
      storage.removeItem("tentacle_token");
      storage.removeItem("tentacle_user");
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
          {children}
        </JellyfinClientContext.Provider>
      </TentacleConfigContext.Provider>
    </QueryClientProvider>
  );
}
