import { useState, useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  JellyfinClient,
  JellyfinClientContext,
  TentacleConfigContext,
  setSeerrBackendUrl,
} from "@tentacle/api-client";
import { RNStorageAdapter, RNUuidGenerator } from "@/storage/RNStorageAdapter";

const JELLYFIN_URL = "https://jelly.rouge-informatique.ch";
const BACKEND_URL = "https://tentacle.rouge-informatique.ch";

const storage = new RNStorageAdapter();
const uuid = new RNUuidGenerator();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 60_000 },
  },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const segments = useSegments();
  const router = useRouter();
  const token = storage.getItem("tentacle_token");

  useEffect(() => {
    const inAuth = segments[0] === "(auth)";
    if (!token && !inAuth) {
      router.replace("/(auth)/login");
    } else if (token && inAuth) {
      router.replace("/(tabs)");
    }
  }, [token, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [client, setClient] = useState<JellyfinClient | null>(null);

  useEffect(() => {
    (async () => {
      await storage.hydrate();
      setSeerrBackendUrl(BACKEND_URL);
      const jfClient = new JellyfinClient(JELLYFIN_URL, storage, uuid, "Mobile");
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
          <AuthGuard>
            <Slot />
          </AuthGuard>
        </JellyfinClientContext.Provider>
      </TentacleConfigContext.Provider>
    </QueryClientProvider>
  );
}
