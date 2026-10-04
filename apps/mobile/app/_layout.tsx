import "react-native-reanimated";
import { useEffect, useState, useCallback, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Stack, SplashScreen } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initI18n, detectLanguage, i18n } from "@tentacle-tv/shared";
import { setPreferencesBackendUrl, fetchInterfaceLanguage } from "@tentacle-tv/api-client";
import { ErrorBoundary } from "@/providers/ErrorBoundary";
import { AppProviders } from "@/providers/AppProviders";
import { ServerUrlContext, useServerUrl } from "@/providers/ServerUrlContext";
import { BrandSpinner } from "@/components/ui";
import { RNStorageAdapter, RNUuidGenerator } from "@/storage/RNStorageAdapter";
import { AuthRedirect } from "@/auth/AuthRedirect";
import { OfflineShell } from "@/offline/OfflineShell";
import { SessionMessageHost } from "@/session/SessionMessageHost";
import { NoticeHost } from "@/notices/NoticeHost";
import { MutationFailureBinding } from "@/notices/MutationFailureBinding";
import { FamilyInvitationHost } from "@/family/FamilyInvitationHost";
import { CardSheetScope } from "@/components/cards/sheet/CardSheetScope";
import { IS_TABLET_DEVICE, useTheme } from "@/theme";
import { useAppFonts } from "@/theme/fonts";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Module-level singletons
const storage = new RNStorageAdapter();
const uuid = new RNUuidGenerator();

// Init i18n immediately so useTranslation works on first render.
// Language will be corrected after storage hydration if needed.
// Au premier lancement rien n'est stocké : la langue de l'appareil, pas un
// français en dur — la mention légale s'affichait en français sur un
// téléphone anglais.
initI18n({ lng: detectLanguage() });

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
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

  // Callback exposed to server-setup + changeServer flows
  const handleSetServerUrl = useCallback((url: string | null) => {
    if (url) {
      storage.setItem("tentacle_server_url", url);
    } else {
      storage.removeItem("tentacle_server_url");
    }
    setServerUrl(url);
  }, []);
  // Valeur stable : un objet neuf à chaque rendu faisait re-rendre tous ses
  // consommateurs (cartes de recommandation, épisodes, accueil…).
  const serverUrlValue = useMemo(() => ({ serverUrl, setServerUrl: handleSetServerUrl }), [serverUrl, handleSetServerUrl]);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ServerUrlContext.Provider value={serverUrlValue}>
          <AuthRedirect storage={storage} ready={ready} />
          <AppProviders storage={storage} uuid={uuid} serverUrl={serverUrl} storageReady={ready}>
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
  const { serverUrl } = useServerUrl();
  const surface = theme.colors.surface.s0;
  const screenOptions = useMemo(() => ({
    headerShown: false,
    gestureEnabled: true,
    contentStyle: { backgroundColor: surface },
    // Défaut app : portrait sur téléphone, libre sur tablette (iPad
    // ET tablette Android). Déclaratif par écran via
    // react-native-screens — `watch/[itemId]` force "all" pour que
    // le téléphone tourne aussi dans le lecteur vidéo.
    orientation: IS_TABLET_DEVICE ? "all" as const : "portrait_up" as const,
  }), [surface]);
  return (
    <>
      <StatusBar style={theme.statusBarStyle} />
      {/* La feuille d'appui long des cartes, pour tous les écrans empilés (la
          recherche, modale, a la sienne). */}
      <CardSheetScope>
        <Stack screenOptions={screenOptions}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="media/[itemId]" options={{ presentation: "card" }} />
          <Stack.Screen name="person/[personId]" options={{ presentation: "card" }} />
          <Stack.Screen name="watch/[itemId]" options={{ presentation: "fullScreenModal", orientation: "all" }} />
          <Stack.Screen name="plugin/[pluginId]" options={{ presentation: "card" }} />
          <Stack.Screen name="library/[libraryId]" options={{ presentation: "card" }} />
          <Stack.Screen name="watchlist" options={{ presentation: "card" }} />
          <Stack.Screen name="favorites" options={{ presentation: "card" }} />
          <Stack.Screen name="stats" options={{ presentation: "card" }} />
          {/* Recherche : plein écran sur iPad (le page-sheet laisse l'accueil
              visible derrière et son swipe-pour-fermer est capricieux). */}
          <Stack.Screen name="search" options={{ presentation: IS_TABLET_DEVICE ? "fullScreenModal" : "modal" }} />
          <Stack.Screen name="pair-tv" options={{ presentation: "card" }} />
          <Stack.Screen name="support" options={{ presentation: "card" }} />
          <Stack.Screen name="help/trailers" options={{ presentation: "card" }} />
          <Stack.Screen name="about" options={{ presentation: "card" }} />
          <Stack.Screen name="credits" options={{ presentation: "card" }} />
          <Stack.Screen name="profile/[section]" options={{ presentation: "card" }} />
          <Stack.Screen name="family" options={{ presentation: "card" }} />
          <Stack.Screen name="settings/password" options={{ presentation: "card" }} />
          <Stack.Screen name="settings/playback" options={{ presentation: "card" }} />
          <Stack.Screen name="settings/notifications" options={{ presentation: "card" }} />
          <Stack.Screen name="settings/devices" options={{ presentation: "card" }} />
          <Stack.Screen name="settings/invites" options={{ presentation: "card" }} />
          <Stack.Screen name="admin/sessions" options={{ presentation: "card" }} />
          <Stack.Screen name="settings/data" options={{ presentation: "card" }} />
          <Stack.Screen name="on-device/index" options={{ presentation: "card" }} />
          <Stack.Screen name="on-device/series/[seriesKey]" options={{ presentation: "card" }} />
          <Stack.Screen name="on-device/item/[itemId]" options={{ presentation: "card" }} />
          <Stack.Screen name="on-device/library" options={{ presentation: "card" }} />
          <Stack.Screen name="settings/on-device" options={{ presentation: "card" }} />

          <Stack.Screen name="settings/personalization" options={{ presentation: "card" }} />
        </Stack>
      </CardSheetScope>
      <OfflineShell />
      {/* Les avertissements (serveur, TMDB, clé d'administration) : un à la fois, jamais sur le lecteur. */}
      <NoticeHost />
      <MutationFailureBinding />
      {/* L'affiche d'invitation de la Famille : au lancement et en direct, jamais sur le
          lecteur. Montée une fois le stockage relu ET le serveur connu : plus tôt, sa
          lecture de `/api/config` partait sans hôte et ne réessayait jamais. */}
      {serverUrl && !showLoading ? <FamilyInvitationHost /> : null}
      {/* Les messages de l'administrateur, au-dessus de tout — lecteur compris. */}
      <SessionMessageHost />
      {showLoading && (
        <View style={[styles.loading, { backgroundColor: theme.colors.surface.s0 }]}>
          <BrandSpinner size="large" />
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
