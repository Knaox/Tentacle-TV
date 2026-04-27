import React, { useState, useEffect } from "react";
import { View, ActivityIndicator, AppState } from "react-native";
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
  setWsBackendUrl,
  fetchInterfaceLanguage,
  hydrateQueryClient,
  attachQueryPersister,
  HOME_PERSIST_WHITELIST,
} from "@tentacle-tv/api-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initI18n, i18n } from "@tentacle-tv/shared";
import { RNStorageAdapter, RNUuidGenerator } from "./storage/RNStorageAdapter";
import { AppNavigator } from "./navigation/AppNavigator";
import { SidebarProvider } from "./context/SidebarContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { OfflineBanner } from "./components/OfflineBanner";
import { useServerReachable } from "./hooks/useServerReachable";
import { navigationRef } from "./navigation/navigationRef";
import { refreshWithRetry, attemptReAuth as attemptReAuthHelper } from "./auth/tokenRefresh";
import { readCredentials, clearCredentials } from "./auth/credentialManager";
import { DirectStreamingSync } from "./components/DirectStreamingSync";

const storage = new RNStorageAdapter();
const uuid = new RNUuidGenerator();

/** Mutex global anti-concurrence : empêche que onAuthExpired et le validateur
 *  AppState tentent un refresh en parallèle. */
let isRefreshing = false;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      cacheTime: 30 * 60 * 1000, // TV est encore sur React Query v4 — `cacheTime` (renommé en `gcTime` à partir de v5)
    },
  },
});

// Cold start TV : hydrate le cache home depuis AsyncStorage avant render.
const tvPersistStorage = {
  getItem: (k: string) => AsyncStorage.getItem(k),
  setItem: (k: string, v: string) => AsyncStorage.setItem(k, v),
  removeItem: (k: string) => AsyncStorage.removeItem(k),
};
void hydrateQueryClient(queryClient, tvPersistStorage, {
  whitelist: HOME_PERSIST_WHITELIST,
});
attachQueryPersister(queryClient, tvPersistStorage, {
  whitelist: HOME_PERSIST_WHITELIST,
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
  setWsBackendUrl(baseUrl);

  const jellyfinUrl = `${baseUrl}/api/jellyfin`;
  const TV_VERSION: string = require("../package.json").version ?? "0.9.2";
  const jfClient = new JellyfinClient(jellyfinUrl, storage, uuid, "AndroidTV", "Tentacle TV - TV", TV_VERSION);

  const savedToken = storage.getItem("tentacle_token");
  if (savedToken) {
    jfClient.setAccessToken(savedToken);
    setPreferencesToken(savedToken);
  }

  jfClient.setOnAuthExpired(async () => {
    if (isRefreshing) return;
    isRefreshing = true;
    try {
      await runAuthRefreshFlow(jfClient);
    } finally {
      isRefreshing = false;
    }
  });

  return jfClient;
}

/** Force le retour à l'écran de login en nettoyant la session locale. */
function doLogout(jfClient: JellyfinClient): void {
  storage.removeItem("tentacle_token");
  storage.removeItem("tentacle_user");
  storage.removeItem("tentacle_jellyfin_token");
  storage.removeItem("tentacle_jellyfin_url");
  clearCredentials(storage);
  setPreferencesToken(null);
  jfClient.setAccessToken(null);
  queryClient.clear();
  if (navigationRef.isReady()) {
    navigationRef.reset({ index: 0, routes: [{ name: "Login" }] });
  }
}

/**
 * Stratégie complète de récupération de session :
 *  1. refreshWithRetry (3 tentatives avec backoff)
 *  2. Si "expired" confirmé → attemptReAuth avec credentials sauvés
 *  3. Si tout échoue → doLogout
 *
 * Toute erreur réseau / serveur conserve la session (pas de logout).
 */
async function runAuthRefreshFlow(jfClient: JellyfinClient): Promise<void> {
  const token = storage.getItem("tentacle_token");
  const serverUrl = storage.getItem("tentacle_server_url");
  if (!token || !serverUrl) {
    doLogout(jfClient);
    return;
  }

  const refresh = await refreshWithRetry({ serverUrl, token });
  if (refresh.ok) {
    jfClient.setAccessToken(refresh.accessToken);
    setPreferencesToken(refresh.accessToken);
    storage.setItem("tentacle_token", refresh.accessToken);
    jfClient.resetAuthState();
    return;
  }

  // Réseau/serveur down : garder la session intacte, l'utilisateur n'a rien fait de mal.
  if (refresh.reason !== "expired") return;

  // Token réellement expiré — tenter un re-login complet avec les credentials sauvés
  const creds = readCredentials(storage);
  if (creds) {
    const newToken = await attemptReAuthHelper({
      serverUrl,
      username: creds.username,
      password: creds.password,
    });
    if (newToken) {
      jfClient.setAccessToken(newToken);
      setPreferencesToken(newToken);
      storage.setItem("tentacle_token", newToken);
      jfClient.resetAuthState();
      return;
    }
  }

  // Plus aucun moyen de récupérer la session — retour login
  doLogout(jfClient);
}

/** Validateur de session au retour au premier plan.
 *  Sur Android TV, l'app peut rester en arrière-plan plusieurs heures (utilisateur
 *  qui change de source HDMI). Au retour, on revalide silencieusement le token. */
function ForegroundSessionValidator() {
  const client = useJellyfinClient();
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (state) => {
      if (state !== "active" || isRefreshing) return;
      const token = storage.getItem("tentacle_token");
      const serverUrl = storage.getItem("tentacle_server_url");
      if (!token || !serverUrl) return;
      isRefreshing = true;
      try {
        await runAuthRefreshFlow(client);
      } finally {
        isRefreshing = false;
      }
    });
    return () => sub.remove();
  }, [client]);
  return null;
}

/** Contenu principal — nécessite QueryClientProvider comme parent */
function AppContent({ serverUrl }: { serverUrl: string | null }) {
  const { isReachable, retry } = useServerReachable(serverUrl);
  return (
    <>
      <ForegroundSessionValidator />
      <DirectStreamingSync storage={storage} />
      <SidebarProvider>
        <NavigationContainer ref={navigationRef} theme={darkTheme}>
          <AppNavigator />
          <OfflineBanner visible={!isReachable} onRetry={retry} />
        </NavigationContainer>
      </SidebarProvider>
    </>
  );
}

export function App() {
  const [ready, setReady] = useState(false);
  const [client, setClient] = useState<JellyfinClient | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);

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

      setServerUrl(tentacleUrl);
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
            <AppContent serverUrl={serverUrl} />
          </JellyfinClientContext.Provider>
        </TentacleConfigContext.Provider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
