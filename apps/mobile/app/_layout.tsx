import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { View, ActivityIndicator } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
} from "@tentacle-tv/api-client";
import { initI18n } from "@tentacle-tv/shared";
import { RNStorageAdapter, RNUuidGenerator } from "@/storage/RNStorageAdapter";

const storage = new RNStorageAdapter();
const uuid = new RNUuidGenerator();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 60_000 },
  },
});

/* ── Server URL context ── */
interface ServerUrlContextValue {
  serverUrl: string | null;
  setServerUrl: (url: string) => void;
}

const ServerUrlContext = createContext<ServerUrlContextValue>({
  serverUrl: null,
  setServerUrl: () => {},
});

export function useServerUrl() {
  return useContext(ServerUrlContext);
}

/* ── Configure all backend URLs from a Tentacle server URL ── */
function configureBackendUrls(tentacleUrl: string) {
  setSeerrBackendUrl(tentacleUrl);
  setPreferencesBackendUrl(tentacleUrl);
  setRequestsBackendUrl(tentacleUrl);
  setTicketsBackendUrl(tentacleUrl);
  setNotificationsBackendUrl(tentacleUrl);
  setConfigBackendUrl(tentacleUrl);
}

/* ── Auth & server guard ── */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const segments = useSegments();
  const router = useRouter();
  const { serverUrl } = useServerUrl();
  const token = storage.getItem("tentacle_token");

  useEffect(() => {
    const inAuth = segments[0] === "(auth)";

    if (!serverUrl) {
      // No server URL configured → send to server setup
      if (!(inAuth && segments[1] === "server-setup")) {
        router.replace("/(auth)/server-setup");
      }
    } else if (!token && !inAuth) {
      // Server configured but not logged in → send to login
      router.replace("/(auth)/login");
    } else if (token && inAuth) {
      // Logged in but still in auth flow → go to main app
      router.replace("/(tabs)");
    }
  }, [token, segments, serverUrl]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [client, setClient] = useState<JellyfinClient | null>(null);
  const [serverUrl, setServerUrlState] = useState<string | null>(null);

  // Callback to save the server URL and initialize the client
  const setServerUrl = useCallback((url: string) => {
    const trimmed = url.replace(/\/+$/, "");
    storage.setItem("tentacle_server_url", trimmed);
    setServerUrlState(trimmed);

    // Configure all backend service URLs
    configureBackendUrls(trimmed);

    // Create / update JellyfinClient with baseUrl = {tentacleUrl}/api/jellyfin
    const jfClient = new JellyfinClient(
      `${trimmed}/api/jellyfin`,
      storage,
      uuid,
      "Mobile",
    );
    const savedToken = storage.getItem("tentacle_token");
    if (savedToken) jfClient.setAccessToken(savedToken);
    jfClient.setOnAuthExpired(() => {
      storage.removeItem("tentacle_token");
      storage.removeItem("tentacle_user");
      queryClient.clear();
    });
    setClient(jfClient);
  }, []);

  useEffect(() => {
    (async () => {
      await storage.hydrate();

      const savedLang = storage.getItem("tentacle_language") ?? "en";
      initI18n({ lng: savedLang });

      const savedUrl = storage.getItem("tentacle_server_url");

      if (savedUrl) {
        // Server URL already configured — initialize everything
        configureBackendUrls(savedUrl);
        const jfClient = new JellyfinClient(
          `${savedUrl}/api/jellyfin`,
          storage,
          uuid,
          "Mobile",
        );
        const savedToken = storage.getItem("tentacle_token");
        if (savedToken) jfClient.setAccessToken(savedToken);
        jfClient.setOnAuthExpired(() => {
          storage.removeItem("tentacle_token");
          storage.removeItem("tentacle_user");
          queryClient.clear();
        });
        setClient(jfClient);
        setServerUrlState(savedUrl);
      } else {
        // No server URL — create a placeholder client (will be replaced after setup)
        const jfClient = new JellyfinClient(
          "https://placeholder.invalid",
          storage,
          uuid,
          "Mobile",
        );
        setClient(jfClient);
      }

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
      <ServerUrlContext.Provider value={{ serverUrl, setServerUrl }}>
        <TentacleConfigContext.Provider value={{ storage, uuid }}>
          <JellyfinClientContext.Provider value={client}>
            <AuthGuard>
              <Slot />
            </AuthGuard>
          </JellyfinClientContext.Provider>
        </TentacleConfigContext.Provider>
      </ServerUrlContext.Provider>
    </QueryClientProvider>
  );
}
