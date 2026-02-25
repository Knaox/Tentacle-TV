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
} from "@tentacle/api-client";
import { RNStorageAdapter, RNUuidGenerator } from "./storage/RNStorageAdapter";
import { AppNavigator } from "./navigation/AppNavigator";

// TODO: Make these configurable via a settings screen
const JELLYFIN_URL = "https://jelly.rouge-informatique.ch";
const BACKEND_URL = "https://tentacle.rouge-informatique.ch";

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

export function App() {
  const [ready, setReady] = useState(false);
  const [client, setClient] = useState<JellyfinClient | null>(null);

  useEffect(() => {
    (async () => {
      await storage.hydrate();
      setSeerrBackendUrl(BACKEND_URL);
      setPreferencesBackendUrl(BACKEND_URL);
      setRequestsBackendUrl(BACKEND_URL);
      setTicketsBackendUrl(BACKEND_URL);
      setNotificationsBackendUrl(BACKEND_URL);
      setConfigBackendUrl(BACKEND_URL);
      const jfClient = new JellyfinClient(JELLYFIN_URL, storage, uuid, "AndroidTV");
      const savedToken = storage.getItem("tentacle_token");
      if (savedToken) jfClient.setAccessToken(savedToken);
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
