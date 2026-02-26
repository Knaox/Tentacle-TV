import { useState, useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavigationContainer } from "@react-navigation/native";
import {
  JellyfinClient,
  JellyfinClientContext,
  TentacleConfigContext,
  setSeerrBackendUrl,
  setPreferencesBackendUrl,
  setRequestsBackendUrl,
  setTicketsBackendUrl,
  setNotificationsBackendUrl,
  setConfigBackendUrl,
  setPairingBackendUrl,
} from "@tentacle/api-client";
import { initI18n, i18n } from "@tentacle/shared";
import { RNStorageAdapter, RNUuidGenerator } from "./storage/RNStorageAdapter";
import { AppNavigator } from "./navigation/AppNavigator";

const storage = new RNStorageAdapter();
const uuid = new RNUuidGenerator();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 60_000 },
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

/**
 * Configure all backend URL singletons and create the JellyfinClient
 * based on the saved tentacle_server_url.
 *
 * If no URL is saved yet (first launch), a placeholder JellyfinClient
 * is created — the ServerSetupScreen will set the real URL and the
 * LoginScreen will reconfigure before authenticating.
 */
function initializeBackend(tentacleUrl: string | null): JellyfinClient {
  const baseUrl = tentacleUrl || "http://localhost";

  setSeerrBackendUrl(baseUrl);
  setPreferencesBackendUrl(baseUrl);
  setRequestsBackendUrl(baseUrl);
  setTicketsBackendUrl(baseUrl);
  setNotificationsBackendUrl(baseUrl);
  setConfigBackendUrl(baseUrl);
  setPairingBackendUrl(baseUrl);

  // Jellyfin API is proxied through the Tentacle backend at /api/jellyfin
  const jellyfinUrl = `${baseUrl}/api/jellyfin`;
  const jfClient = new JellyfinClient(jellyfinUrl, storage, uuid, "AndroidTV");

  const savedToken = storage.getItem("tentacle_token");
  if (savedToken) jfClient.setAccessToken(savedToken);

  return jfClient;
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
      jfClient.setLanguage(savedLang);
      // Keep client language in sync when i18n language changes
      i18n.on("languageChanged", (lng: string) => {
        jfClient.setLanguage(lng);
      });
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
    <QueryClientProvider client={queryClient}>
      <TentacleConfigContext.Provider value={{ storage, uuid }}>
        <JellyfinClientContext.Provider value={client}>
          <NavigationContainer theme={darkTheme}>
            <AppNavigator />
          </NavigationContainer>
        </JellyfinClientContext.Provider>
      </TentacleConfigContext.Provider>
    </QueryClientProvider>
  );
}
