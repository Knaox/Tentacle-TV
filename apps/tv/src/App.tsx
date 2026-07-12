import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { View, ActivityIndicator, AppState, Settings, Platform, type AppStateStatus } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavigationContainer } from "@react-navigation/native";
import { DEFAULT_THEME } from "@tentacle-tv/theme";
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
import { initI18n, i18n } from "@tentacle-tv/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { RNStorageAdapter, RNUuidGenerator, IS_TVOS } from "./storage/RNStorageAdapter";
import { AppNavigator } from "./navigation/AppNavigator";
import { SidebarProvider } from "./context/SidebarContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { OfflineBanner } from "./components/OfflineBanner";
import { useServerReachable } from "./hooks/useServerReachable";
import { navigationRef } from "./navigation/navigationRef";
import { runAuthRefreshFlow, doLogout } from "./auth/sessionFlow";
import { DirectStreamingSync } from "./components/DirectStreamingSync";
import { ForegroundDataRefresher } from "./components/ForegroundDataRefresher";
import { TVNavChrome, deriveRailKey } from "./components/nav/TVNavChrome";
import { TVNavProvider } from "./context/TVNavContext";
import { ThemeProvider, useTheme } from "./theme";

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

// Cold start TV : cache home persisté via Settings (NSUserDefaults) sur tvOS,
// AsyncStorage sur Android TV (Settings y est un no-op sans persistance) —
// interface async attendue par le persister.
//
// ⚠️ tvOS abort l'app (SIGABRT, __CFPREFERENCES_HAS_DETECTED_THIS_APP_TRYING_TO_
// STORE_TOO_MUCH_DATA__) au-delà d'une limite stricte du domaine NSUserDefaults
// (~0,5 Mo). Le défaut 2 Mo du persister dépassait → crash « de temps en temps »
// quand le cache home gonflait. On plafonne BIEN en dessous + garde-fou dur
// (plafond conservé à l'identique sur Android : un cache home > 256 K n'apporte
// rien au cold start et resterait à re-fetcher de toute façon).
const TV_PERSIST_MAX = 256 * 1024; // ~256 K caractères

const tvPersistStorage = {
  getItem: (k: string) => {
    if (!IS_TVOS) return AsyncStorage.getItem(k);
    const v = Settings.get(k);
    return Promise.resolve(typeof v === "string" ? v : null);
  },
  // Jamais d'écriture surdimensionnée vers NSUserDefaults : au-delà de la limite
  // on PURGE la clé (null) au lieu d'écrire → impossible de crasher CFPreferences.
  setItem: (k: string, v: string) => {
    if (!IS_TVOS) {
      return v.length > TV_PERSIST_MAX ? AsyncStorage.removeItem(k) : AsyncStorage.setItem(k, v);
    }
    Settings.set({ [k]: v.length > TV_PERSIST_MAX ? null : v });
    return Promise.resolve();
  },
  removeItem: (k: string) => {
    if (!IS_TVOS) return AsyncStorage.removeItem(k);
    Settings.set({ [k]: null });
    return Promise.resolve();
  },
};

// `library-items` (potentiellement énorme : tout le contenu d'une bibliothèque)
// exclu de la persistance TV — re-fetché à la navigation, inutile au cold start
// home et principal responsable du dépassement de la limite NSUserDefaults.
const TV_HOME_WHITELIST = HOME_PERSIST_WHITELIST.filter((k) => k !== "library-items");

// Purge unique d'un blob déjà surdimensionné (laissé par l'ancien plafond 2 Mo)
// pour repartir d'un domaine NSUserDefaults sain. tvOS only : Settings n'existe
// pas sur Android (et le plafond y est appliqué à l'écriture).
if (IS_TVOS) {
  const existing = Settings.get("tentacle_query_cache_v1");
  if (typeof existing === "string" && existing.length > TV_PERSIST_MAX) {
    Settings.set({ tentacle_query_cache_v1: null });
  }
}

void hydrateQueryClient(queryClient, tvPersistStorage, {
  whitelist: TV_HOME_WHITELIST,
});
attachQueryPersister(queryClient, tvPersistStorage, {
  whitelist: TV_HOME_WHITELIST,
  maxBytes: TV_PERSIST_MAX,
});

/** React Navigation theme — `#0a0a0f`, `#12121a`, `#1e1e2e` n'ont pas de token
 *  équivalent dans `@tentacle-tv/theme` (couleurs TV-spécifiques OLED) ; gardés
 *  en littéral pour rester strictement lossless. Les tokens qui MATCHENT sont
 *  lus dynamiquement via `useTheme()` dans `AppContent`. */
const navFonts = {
  regular: { fontFamily: "System", fontWeight: "400" as const },
  medium: { fontFamily: "System", fontWeight: "500" as const },
  bold: { fontFamily: "System", fontWeight: "700" as const },
  heavy: { fontFamily: "System", fontWeight: "900" as const },
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
  // Nom de client rapporté à Jellyfin : « Apple TV » sur tvOS (l'app s'identifiait
  // à tort comme AndroidTV). Android conservé EXACTEMENT (pas d'espace) pour ne
  // pas changer l'identifiant des devices Android déjà appariés.
  const clientName = Platform.OS === "ios" ? "Apple TV" : "AndroidTV";
  const jfClient = new JellyfinClient(jellyfinUrl, storage, uuid, clientName, "Tentacle TV - TV", TV_VERSION);

  const savedToken = storage.getItem("tentacle_token");
  if (savedToken) {
    jfClient.setAccessToken(savedToken);
    setPreferencesToken(savedToken);
  }

  jfClient.setOnAuthExpired(async () => {
    if (isRefreshing) return;
    isRefreshing = true;
    try {
      // setOnAuthExpired = preuve forte que le token actuel est mort (5×401 sur
      // les requêtes Jellyfin). Si tout échoue : doLogout, c'est légitime.
      await runAuthRefreshFlow(jfClient, storage, queryClient, { softFail: false });
    } finally {
      isRefreshing = false;
    }
  });

  return jfClient;
}

/** Validateur de session au retour au premier plan.
 *  Sur Android TV, l'app peut rester en arrière-plan plusieurs heures (utilisateur
 *  qui change de source HDMI). Au retour, on revalide silencieusement le token.
 *
 *  Précautions critiques :
 *  - On ne valide QUE sur une vraie transition `background|inactive → active`,
 *    PAS au tout premier event (qui peut être spurious au cold start sur certaines
 *    builds Android TV) — sinon, force-stop puis relance redirige sur Login.
 *  - On utilise `softFail: true` : si tout échoue on garde la session, on laisse
 *    le seuil 5×401 du JellyfinClient arbitrer si une vraie déconnexion s'impose.
 */
function ForegroundSessionValidator() {
  const client = useJellyfinClient();
  const previousStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener("change", async (state) => {
      const previous = previousStateRef.current;
      previousStateRef.current = state;

      // Ne valide que les transitions background|inactive → active.
      // Le cold start envoie souvent un event "active" depuis un état initial
      // déjà "active" ou "unknown" — on ignore.
      if (state !== "active") return;
      if (previous === "active" || previous === "unknown") return;
      if (isRefreshing) return;

      const token = storage.getItem("tentacle_token");
      const serverUrl = storage.getItem("tentacle_server_url");
      if (!token || !serverUrl) return;

      isRefreshing = true;
      try {
        await runAuthRefreshFlow(client, storage, queryClient, { softFail: true });
      } finally {
        isRefreshing = false;
      }
    });
    return () => sub.remove();
  }, [client]);
  return null;
}

/** Contenu principal — nécessite QueryClientProvider + ThemeProvider comme parents */
function AppContent({ serverUrl: initialServerUrl }: { serverUrl: string | null }) {
  // L'URL serveur peut changer en cours de session : déconnexion (supprimée du
  // storage) ou re-jumelage (nouvelle URL). On la relit à chaque changement de
  // navigation pour que la détection offline cible toujours le bon serveur ;
  // sans ça, l'overlay restait bloqué sur l'ancienne URL après un logout et
  // recouvrait l'écran de jumelage (« Se déconnecter » semblait sans effet).
  const [serverUrl, setServerUrl] = useState<string | null>(initialServerUrl);
  const { isReachable, retry } = useServerReachable(serverUrl);
  const { theme } = useTheme();
  // Route active du rail : suivie via le NavigationContainer (le rail est un
  // sibling du Navigator, sans accès aux hooks de navigation).
  const [railKey, setRailKey] = useState<string | null>(null);
  const syncRailKey = useCallback(() => {
    // Ne mettre à jour railKey QUE quand la nav est prête : sinon une synchro
    // transitoire (isReady=false) effaçait le rail (null) → side bar qui
    // disparaît. deriveRailKey renvoie déjà null légitimement pour les écrans
    // plein écran (Player/MediaDetail), donc on n'affiche jamais le rail à tort.
    if (navigationRef.isReady()) {
      setRailKey(deriveRailKey(navigationRef.getRootState()));
    }
    setServerUrl(storage.getItem("tentacle_server_url"));
  }, []);
  const navTheme = useMemo(
    () => ({
      dark: true as const,
      colors: {
        primary: theme.tokens.color.brand.base,
        background: "#0a0a0f",
        card: "#12121a",
        text: theme.tokens.color.text.primary,
        border: "#1e1e2e",
        notification: theme.tokens.color.brand.base,
      },
      fonts: navFonts,
    }),
    [theme],
  );
  return (
    <>
      <ForegroundSessionValidator />
      <ForegroundDataRefresher />
      <DirectStreamingSync storage={storage} />
      <SidebarProvider>
        <TVNavProvider>
          <NavigationContainer
            ref={navigationRef}
            theme={navTheme}
            onReady={syncRailKey}
            onStateChange={syncRailKey}
          >
            <AppNavigator />
            {/* Rail persistant monté une seule fois (overlay sibling du Navigator) */}
            <TVNavChrome railKey={railKey} />
            <OfflineBanner visible={!isReachable} onRetry={retry} />
          </NavigationContainer>
        </TVNavProvider>
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
    // Pre-provider mount: use DEFAULT_THEME static brand color (admin override
    // not yet fetched). `#0a0a0f` has no matching token — kept as literal.
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0a0f" }}>
        <ActivityIndicator size="large" color={DEFAULT_THEME.tokens.color.brand.base} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider backendUrl={serverUrl}>
          <TentacleConfigContext.Provider value={{ storage, uuid }}>
            <JellyfinClientContext.Provider value={client}>
              <AppContent serverUrl={serverUrl} />
            </JellyfinClientContext.Provider>
          </TentacleConfigContext.Provider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
