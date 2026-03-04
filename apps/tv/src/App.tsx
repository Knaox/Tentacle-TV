import React, { useState, useEffect, useCallback } from "react";
import { View, ActivityIndicator } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavigationContainer } from "@react-navigation/native";
import {
  JellyfinClient,
  JellyfinClientContext,
  TentacleConfigContext,
  useJellyfinClient,
  setPreferencesBackendUrl,
  setTicketsBackendUrl,
  setNotificationsBackendUrl,
  setConfigBackendUrl,
  setPairingBackendUrl,
  setPreferencesToken,
  setStreamingConfigBackendUrl,
  useStreamingConfig,
  fetchInterfaceLanguage,
} from "@tentacle-tv/api-client";
import { initI18n, i18n } from "@tentacle-tv/shared";
import { RNStorageAdapter, RNUuidGenerator } from "./storage/RNStorageAdapter";
import { AppNavigator } from "./navigation/AppNavigator";
import { SidebarProvider } from "./context/SidebarContext";
import { ErrorBoundary } from "./components/ErrorBoundary";

const storage = new RNStorageAdapter();
const uuid = new RNUuidGenerator();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    },
  },
});

const darkTheme = {
  dark: true as const,
  colors: {
    primary: "#8b5cf6",
    background: "#0a0a0f",
    card: "#12121a",
    text: "#ffffff",
    border: "#1e1e2e",
    notification: "#8b5cf6",
  },
  fonts: {
    regular: { fontFamily: "System", fontWeight: "400" as const },
    medium: { fontFamily: "System", fontWeight: "500" as const },
    bold: { fontFamily: "System", fontWeight: "700" as const },
    heavy: { fontFamily: "System", fontWeight: "900" as const },
  },
};

function initializeBackend(tentacleUrl: string | null): JellyfinClient {
  const baseUrl = tentacleUrl || "http://localhost";

  setPreferencesBackendUrl(baseUrl);
  setTicketsBackendUrl(baseUrl);
  setNotificationsBackendUrl(baseUrl);
  setConfigBackendUrl(baseUrl);
  setPairingBackendUrl(baseUrl);
  setStreamingConfigBackendUrl(baseUrl);

  const jellyfinUrl = `${baseUrl}/api/jellyfin`;
  const jfClient = new JellyfinClient(jellyfinUrl, storage, uuid, "AndroidTV");

  const savedToken = storage.getItem("tentacle_token");
  if (savedToken) {
    jfClient.setAccessToken(savedToken);
    setPreferencesToken(savedToken);
  }

  jfClient.setOnAuthExpired(() => {
    storage.removeItem("tentacle_token");
    storage.removeItem("tentacle_user");
    setPreferencesToken(null);
    queryClient.clear();
  });

  return jfClient;
}

/** Sync direct streaming config from backend into JellyfinClient. */
function DirectStreamingSync() {
  const client = useJellyfinClient();
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

  return null;
}

export function App() {
  const [ready, setReady] = useState(false);
  const [client, setClient] = useState<JellyfinClient | null>(null);

  useEffect(() => {
    (async () => {
      await storage.hydrate();
      const tentacleUrl = storage.getItem("tentacle_server_url");
      const savedLang = storage.getItem("tentacle_language") ?? "en";
      initI18n({ lng: savedLang });
      const jfClient = initializeBackend(tentacleUrl);

      // Fetch authoritative language from backend (bidirectional sync)
      const token = storage.getItem("tentacle_token");
      if (token) {
        try {
          const backendLang = await fetchInterfaceLanguage(token);
          if (backendLang && backendLang !== savedLang) {
            i18n.changeLanguage(backendLang);
            storage.setItem("tentacle_language", backendLang);
          }
        } catch { /* silent — use local cache */ }
      }

      setClient(jfClient);
      setReady(true);
    })();
  }, []);

  if (!ready || !client) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0a0f" }}>
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TentacleConfigContext.Provider value={{ storage, uuid }}>
          <JellyfinClientContext.Provider value={client}>
            <DirectStreamingSync />
            <SidebarProvider>
              <NavigationContainer theme={darkTheme}>
                <AppNavigator />
              </NavigationContainer>
            </SidebarProvider>
          </JellyfinClientContext.Provider>
        </TentacleConfigContext.Provider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
