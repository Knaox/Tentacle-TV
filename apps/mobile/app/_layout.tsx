import "react-native-reanimated";
import { useEffect, useState, useCallback } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Stack, useRouter, useSegments, SplashScreen } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initI18n, i18n } from "@tentacle-tv/shared";
import { ErrorBoundary } from "@/providers/ErrorBoundary";
import { AppProviders } from "@/providers/AppProviders";
import { ServerUrlContext } from "@/providers/ServerUrlContext";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useServerReachable } from "@/hooks/useServerReachable";
import { RNStorageAdapter, RNUuidGenerator } from "@/storage/RNStorageAdapter";
import { colors } from "@/theme";

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
  return <OfflineBanner visible={!isReachable} onRetry={retry} />;
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const segments = useSegments();
  const router = useRouter();

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

      setServerUrl(url);
      setReady(true);
      await SplashScreen.hideAsync();
    }

    init();
    return () => { mounted = false; };
  }, []);

  // Auth guard: redirect based on stored credentials
  useEffect(() => {
    if (!ready) return;

    const inAuthGroup = segments[0] === "(auth)";
    const url = storage.getItem("tentacle_server_url");
    const token = storage.getItem("tentacle_token");

    if (!url) {
      const onSetup = segments[0] === "(auth)" && segments[1] === "server-setup";
      if (!onSetup) {
        router.replace("/(auth)/server-setup");
      }
    } else if (url && !token && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (url && token && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [ready, segments, router]);

  // Callback exposed to server-setup screen
  const handleSetServerUrl = useCallback((url: string) => {
    storage.setItem("tentacle_server_url", url);
    setServerUrl(url);
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ServerUrlContext.Provider value={{ serverUrl, setServerUrl: handleSetServerUrl }}>
          <AppProviders storage={storage} uuid={uuid} serverUrl={serverUrl}>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false, gestureEnabled: true, contentStyle: { backgroundColor: colors.background } }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="media/[itemId]" options={{ presentation: "card" }} />
              <Stack.Screen name="watch/[itemId]" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="plugin/[pluginId]" options={{ presentation: "card" }} />
              <Stack.Screen name="library/[libraryId]" options={{ presentation: "card" }} />
              <Stack.Screen name="search" options={{ presentation: "modal" }} />
              <Stack.Screen name="pair-tv" options={{ presentation: "card" }} />
              <Stack.Screen name="support" options={{ presentation: "card" }} />
              <Stack.Screen name="about" options={{ presentation: "card" }} />
              <Stack.Screen name="credits" options={{ presentation: "card" }} />
            </Stack>
            <OfflineOverlay />
            {!ready && (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color={colors.accent} />
              </View>
            )}
          </AppProviders>
        </ServerUrlContext.Provider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
});
