import "react-native-reanimated";
import { useEffect, useState, useCallback } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Stack, useRouter, useSegments, SplashScreen } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initI18n, i18n } from "@tentacle-tv/shared";
import { useAuth, useTentacleConfig, setPreferencesBackendUrl, fetchInterfaceLanguage } from "@tentacle-tv/api-client";
import { ErrorBoundary } from "@/providers/ErrorBoundary";
import { AppProviders } from "@/providers/AppProviders";
import { ServerUrlContext } from "@/providers/ServerUrlContext";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useServerReachable } from "@/hooks/useServerReachable";
import { clearCredentials } from "@/auth/credentialManager";
import { RNStorageAdapter, RNUuidGenerator } from "@/storage/RNStorageAdapter";
import { isSessionExpired } from "@/auth/sessionState";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { IS_TABLET_DEVICE, useTheme } from "@/theme";
import { useAppFonts } from "@/theme/fonts";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Module-level singletons
const storage = new RNStorageAdapter();
const uuid = new RNUuidGenerator();

// Init i18n immediately so useTranslation works on first render.
// Language will be corrected after storage hydration if needed.
initI18n({ lng: "fr" });

/** Composant interne — nécessite AppProviders comme parent */
function OfflineOverlay() {
  const { isReachable, retry } = useServerReachable();
  const { logout, changeServer } = useAuth();
  const { storage: appStorage } = useTentacleConfig();
  const { setServerUrl } = useServerUrl();
  const router = useRouter();

  const handleLogout = useCallback(() => {
    logout.mutate(undefined, {
      onSuccess: () => {
        clearCredentials(appStorage);
        router.replace("/(auth)/login");
      },
      onError: () => {
        appStorage.removeItem("tentacle_token");
        appStorage.removeItem("tentacle_user");
        clearCredentials(appStorage);
        router.replace("/(auth)/login");
      },
    });
  }, [logout, appStorage, router]);

  const handleChangeServer = useCallback(() => {
    changeServer.mutate(undefined, {
      onSettled: () => {
        setServerUrl(null);
        router.replace("/(auth)/server-setup");
      },
    });
  }, [changeServer, router, setServerUrl]);

  return (
    <OfflineBanner
      visible={!isReachable}
      onRetry={retry}
      onLogout={handleLogout}
      onChangeServer={handleChangeServer}
    />
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const segments = useSegments();
  const router = useRouter();
  const [fontsLoaded, fontError] = useAppFonts();

  // Hydrate storage, read persisted values, init i18n
  // Timeout 5s to prevent infinite splash on real iPhone if AsyncStorage hangs
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        await Promise.race([
          storage.hydrate(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("hydration_timeout")), 5000)
          ),
        ]);
      } catch (e) {
        console.warn("[RootLayout] Hydration failed:", e);
      }

      if (!mounted) return;

      const url = storage.getItem("tentacle_server_url");
      const lang = storage.getItem("tentacle_language");
      if (lang && lang !== i18n.language) i18n.changeLanguage(lang);

      // Langue d'interface stockée en BASE (synchronisée entre appareils) :
      // rattrape un changement fait depuis le web/TV. Fire-and-forget — le
      // repli local ci-dessus couvre le hors-ligne, on ne bloque pas le splash.
      const token = storage.getItem("tentacle_token");
      if (url && token) {
        setPreferencesBackendUrl(url);
        void fetchInterfaceLanguage(token).then((dbLang) => {
          if (dbLang && dbLang !== i18n.language) {
            i18n.changeLanguage(dbLang);
            storage.setItem("tentacle_language", dbLang);
          }
        });
      }

      setServerUrl(url);
      setReady(true);
    }

    init();
    return () => { mounted = false; };
  }, []);

  // Hide splash only when storage hydrated AND fonts loaded (or font error —
  // fallback system font is acceptable). Prevents flash of unstyled text.
  useEffect(() => {
    if (ready && (fontsLoaded || fontError)) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready, fontsLoaded, fontError]);

  // Auth guard: redirect based on stored credentials
  useEffect(() => {
    if (!ready) return;

    const inAuthGroup = segments[0] === "(auth)";
    const url = storage.getItem("tentacle_server_url");
    const token = storage.getItem("tentacle_token");
    const disclaimerAccepted = storage.getItem("disclaimer_accepted") === "true";

    if (!url) {
      // No server URL yet — show disclaimer first (once), then server-setup
      if (!disclaimerAccepted) {
        const onDisclaimer = inAuthGroup && (segments as string[])[1] === "disclaimer";
        if (!onDisclaimer) {
          router.replace("/(auth)/disclaimer");
        }
      } else {
        const onSetup = inAuthGroup && (segments as string[])[1] === "server-setup";
        if (!onSetup) {
          router.replace("/(auth)/server-setup");
        }
      }
    } else if (url && !token && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (url && token && inAuthGroup && !isSessionExpired()) {
      router.replace("/(tabs)");
    }
  }, [ready, segments, router]);

  // Callback exposed to server-setup + changeServer flows
  const handleSetServerUrl = useCallback((url: string | null) => {
    if (url) {
      storage.setItem("tentacle_server_url", url);
    } else {
      storage.removeItem("tentacle_server_url");
    }
    setServerUrl(url);
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ServerUrlContext.Provider value={{ serverUrl, setServerUrl: handleSetServerUrl }}>
          <AppProviders storage={storage} uuid={uuid} serverUrl={serverUrl}>
            <ThemedShell showLoading={!ready || (!fontsLoaded && !fontError)} />
          </AppProviders>
        </ServerUrlContext.Provider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

/**
 * Shell thémé — rendu SOUS AppProviders pour consommer le thème d'apparence :
 * StatusBar suit le scheme, fond de scène et overlay de chargement thémés.
 */
function ThemedShell({ showLoading }: { showLoading: boolean }) {
  const theme = useTheme();
  return (
    <>
      <StatusBar style={theme.statusBarStyle} />
      <Stack
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          contentStyle: { backgroundColor: theme.colors.surface.s0 },
          // Défaut app : portrait sur téléphone, libre sur tablette (iPad
          // ET tablette Android). Déclaratif par écran via
          // react-native-screens — `watch/[itemId]` force "all" pour que
          // le téléphone tourne aussi dans le lecteur vidéo.
          orientation: IS_TABLET_DEVICE ? "all" : "portrait_up",
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="media/[itemId]" options={{ presentation: "card" }} />
        <Stack.Screen name="watch/[itemId]" options={{ presentation: "fullScreenModal", orientation: "all" }} />
        <Stack.Screen name="plugin/[pluginId]" options={{ presentation: "card" }} />
        <Stack.Screen name="library/[libraryId]" options={{ presentation: "card" }} />
        <Stack.Screen name="watchlist" options={{ presentation: "card" }} />
        <Stack.Screen name="favorites" options={{ presentation: "card" }} />
        {/* Recherche : plein écran sur iPad (le page-sheet laisse l'accueil
            visible derrière et son swipe-pour-fermer est capricieux). */}
        <Stack.Screen name="search" options={{ presentation: IS_TABLET_DEVICE ? "fullScreenModal" : "modal" }} />
        <Stack.Screen name="pair-tv" options={{ presentation: "card" }} />
        <Stack.Screen name="support" options={{ presentation: "card" }} />
        <Stack.Screen name="about" options={{ presentation: "card" }} />
        <Stack.Screen name="credits" options={{ presentation: "card" }} />
      </Stack>
      <OfflineOverlay />
      {showLoading && (
        <View style={[styles.loading, { backgroundColor: theme.colors.surface.s0 }]}>
          <ActivityIndicator size="large" color={theme.colors.brand.violet} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
});
