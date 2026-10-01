import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Settings, Platform } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavigationContainer } from "@react-navigation/native";
import {
  JellyfinClient,
  JellyfinClientContext,
  TentacleConfigContext,
  setPreferencesToken,
  fetchInterfaceLanguage,
  hydrateQueryClient,
  attachQueryPersister,
  HOME_PERSIST_WHITELIST,
} from "@tentacle-tv/api-client";
import { initI18n, detectLanguage, i18n } from "@tentacle-tv/shared";
import { resumeUnpair } from "@tentacle-tv/tv-core";
import { RNUuidGenerator, IS_TVOS, tvStorage } from "./storage/RNStorageAdapter";
import { rehydrateStores } from "./lib/stores";
import { useLiquidGlass } from "./lib/liquidGlass";
import { LiquidGlassProvider } from "./redesign/glass/liquidGlassMode";
import { applyBackendUrl } from "./lib/backendUrls";
import { TV_PERSIST_MAX, tvPersistStorage } from "./storage/queryPersistStorage";
import { AppNavigator } from "./navigation/AppNavigator";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { OfflineBanner } from "./components/OfflineBanner";
import { BootScreen } from "./components/BootScreen";
import { useServerReachable } from "./hooks/useServerReachable";
import { navigationRef } from "./navigation/navigationRef";
import { runAuthRefreshFlow } from "./auth/sessionFlow";
import { wakeRevocationDrain } from "./auth/revocationQueue";
import { ForegroundSessionValidator } from "./components/ForegroundSessionValidator";
import { TVSessionGuard } from "./components/TVSessionGuard";
import { DirectStreamingSync } from "./components/DirectStreamingSync";
import { TVSessionChannel } from "./components/TVSessionChannel";
import { TVSessionMessageHost } from "./components/TVSessionMessageHost";
import { PairingExpiredBanner } from "./components/PairingExpiredBanner";
import { ForegroundDataRefresher } from "./components/ForegroundDataRefresher";
import { TVNavChrome, deriveRailKey } from "./components/nav/TVNavChrome";
import { TVNavProvider } from "./context/TVNavContext";
import { ThemeProvider, useTheme } from "./theme";

// Instance unique, définie dans son module pour que le magasin d'épinglage du
// rail puisse s'y brancher sans dépendre de ce fichier.
const storage = tvStorage;
const uuid = new RNUuidGenerator();

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

// Cold start TV : le stockage du persister (plafond NSUserDefaults compris)
// vit dans `storage/queryPersistStorage.ts`.

// Le contenu des bibliothèques (potentiellement énorme) n'est pas persisté :
// `HOME_PERSIST_WHITELIST` ne liste que les hubs de la home. Il était le
// principal responsable du dépassement de la limite NSUserDefaults, d'où le
// filtre explicite qui vivait ici — désormais inutile, l'entrée morte a été
// retirée de la liste source. Le persister évince par fraîcheur sous
// `maxBytes`, donc un dépassement ne vide plus tout le cache.
const TV_HOME_WHITELIST = HOME_PERSIST_WHITELIST;

// Purge unique d'un blob déjà surdimensionné (laissé par l'ancien plafond 2 Mo)
// pour repartir d'un domaine NSUserDefaults sain. tvOS only : Settings n'existe
// pas sur Android (et le plafond y est appliqué à l'écriture).
if (IS_TVOS) {
  const existing = Settings.get("tentacle_query_cache_v1");
  if (typeof existing === "string" && existing.length > TV_PERSIST_MAX) {
    Settings.set({ tentacle_query_cache_v1: null });
  }
}

const cacheHydrated = hydrateQueryClient(queryClient, tvPersistStorage, {
  whitelist: TV_HOME_WHITELIST,
});
// Sans session, rien ne s'écrit : le cache d'un compte quitté ne revient pas
// sur le disque au tic suivant d'un déjumelage.
attachQueryPersister(queryClient, tvPersistStorage, {
  whitelist: TV_HOME_WHITELIST,
  maxBytes: TV_PERSIST_MAX,
  canSave: () => storage.getItem("tentacle_token") !== null,
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
  applyBackendUrl(baseUrl);

  const jellyfinUrl = `${baseUrl}/api/jellyfin`;
  const TV_VERSION: string = require("../../../versions.json").tv ?? "0.9.2";
  // Nom de client rapporté à Jellyfin : « Apple TV » sur tvOS (l'app s'identifiait
  // à tort comme AndroidTV). Android conservé EXACTEMENT (pas d'espace) pour ne
  // pas changer l'identifiant des devices Android déjà appariés.
  const clientName = Platform.OS === "ios" ? "Apple TV" : "AndroidTV";
  const jfClient = new JellyfinClient(jellyfinUrl, storage, uuid, clientName, "Tentacle TV - TV", TV_VERSION);
  jfClient.followLanguage(i18n); // Jellyfin 12 : les mentions des pistes dans la langue de l'interface.
  const savedToken = storage.getItem("tentacle_token");
  if (savedToken) {
    jfClient.setAccessToken(savedToken);
    setPreferencesToken(savedToken);
  }

  // setOnAuthExpired = preuve forte que le token actuel est mort (5×401 sur
  // les requêtes Jellyfin) : le verdict du serveur tranche, et seule une
  // révocation confirmée déjumelle.
  jfClient.setOnAuthExpired(() => runAuthRefreshFlow(jfClient, storage, queryClient, { softFail: false }));

  return jfClient;
}

/** Contenu principal — nécessite QueryClientProvider + ThemeProvider comme parents */
/** Le serveur à surveiller : celui d'une SESSION. Sans jeton, rien n'est « hors
 *  ligne » — le jumelage traite lui-même ses erreurs de serveur, et un voile
 *  bloquant l'empêcherait d'en choisir un autre (on y restait coincé derrière
 *  « Se déconnecter », sans jeton à effacer). */
const sessionServerUrl = (): string | null =>
  storage.getItem("tentacle_token") ? storage.getItem("tentacle_server_url") : null;

/** Les écrans où une vidéo JOUE : le voile hors ligne ne s'y pose pas. La
 *  lecture d'abord — un film en streaming direct continue sans Tentacle, et le
 *  voile le cachait, piégeait le focus, et son Menu quittait l'application.
 *  Le lecteur dit lui-même ce qui manque ; à la sortie, le voile paraît si la
 *  panne dure. `PlayerSettings` : la modale des réglages d'Android TV, posée
 *  sur un lecteur qui joue encore. */
const PLAYBACK_ROUTES = new Set(["Player", "PlayerSettings", "Trailer"]);

function AppContent() {
  // L'URL serveur peut changer en cours de session : déconnexion (supprimée du
  // storage) ou re-jumelage (nouvelle URL). On la relit à chaque changement de
  // navigation pour que la détection offline cible toujours le bon serveur ;
  // sans ça, l'overlay restait bloqué sur l'ancienne URL après un logout et
  // recouvrait l'écran de jumelage (« Se déconnecter » semblait sans effet).
  const [serverUrl, setServerUrl] = useState<string | null>(sessionServerUrl);
  const { isReachable, retry } = useServerReachable(serverUrl);
  const { theme } = useTheme();
  // Route active du rail : suivie via le NavigationContainer (le rail est un
  // sibling du Navigator, sans accès aux hooks de navigation).
  const [railKey, setRailKey] = useState<string | null>(null);
  const [playbackShown, setPlaybackShown] = useState(false);
  const syncRailKey = useCallback(() => {
    // Ne mettre à jour railKey QUE quand la nav est prête : sinon une synchro
    // transitoire (isReady=false) effaçait le rail (null) → side bar qui
    // disparaît. deriveRailKey renvoie déjà null légitimement pour les écrans
    // plein écran (Player/MediaDetail), donc on n'affiche jamais le rail à tort.
    if (navigationRef.isReady()) {
      const state = navigationRef.getRootState();
      setRailKey(deriveRailKey(state));
      const route = state?.routes?.[state.index];
      setPlaybackShown(!!route && PLAYBACK_ROUTES.has(route.name));
    }
    setServerUrl(sessionServerUrl());
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
      <TVSessionGuard />
      <ForegroundDataRefresher />
      <DirectStreamingSync storage={storage} />
      <TVSessionChannel storage={storage} />
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
            <OfflineBanner visible={!isReachable && !playbackShown} onRetry={retry} />
            <PairingExpiredBanner />
            <TVSessionMessageHost />
          </NavigationContainer>
      </TVNavProvider>
    </>
  );
}

export function App() {
  // Le verre de la refonte suit le réglage de l'appareil (onglet Apparence) :
  // un seul fournisseur, au-dessus de tout, frontière d'erreur comprise.
  const liquidGlass = useLiquidGlass();
  const [ready, setReady] = useState(false);
  const [client, setClient] = useState<JellyfinClient | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      await storage.hydrate();
      // Un déjumelage interrompu (app tuée en pleine purge) se termine AVANT
      // que quoi que ce soit lise la session : jamais un état à moitié jumelé.
      resumeUnpair(storage);
      // Sans session, le cache persisté n'est à personne : ni en mémoire, ni
      // sur le disque.
      await cacheHydrated;
      if (!storage.getItem("tentacle_token")) {
        queryClient.clear();
        storage.removeItem("tentacle_query_cache_v1");
      }
      wakeRevocationDrain();
      // Les magasins de réglages naissent avant cette hydratation : les relire
      // maintenant que le cache est rempli (voir `lib/stores.ts`).
      rehydrateStores();
      const tentacleUrl = storage.getItem("tentacle_server_url");
      const savedLang = storage.getItem("tentacle_language") ?? detectLanguage();
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

  if (!ready || !client) return <BootScreen />;

  return (
    <LiquidGlassProvider enabled={liquidGlass}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider backendUrl={serverUrl}>
            <TentacleConfigContext.Provider value={{ storage, uuid }}>
              <JellyfinClientContext.Provider value={client}>
                <AppContent />
              </JellyfinClientContext.Provider>
            </TentacleConfigContext.Provider>
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </LiquidGlassProvider>
  );
}
