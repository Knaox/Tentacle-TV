import React, { Suspense } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { Colors } from "../theme/colors";
import type { RootStackParamList } from "./types";
import { SkeletonLoader } from "./ScreenFallback";

// Direct imports — initial screens, must load immediately
import { DisclaimerScreen } from "../screens/DisclaimerScreen";
import { PairCodeScreen } from "../screens/PairCodeScreen";
import { HomeScreen } from "../screens/HomeScreen";

// Lazy-loaded screens
const MediaDetailScreen = React.lazy(() => import("../screens/MediaDetailScreen").then(m => ({ default: m.MediaDetailScreen })));
const PlayerScreen = React.lazy(() => import("../screens/PlayerScreen").then(m => ({ default: m.PlayerScreen })));
const SearchScreen = React.lazy(() => import("../screens/SearchScreen").then(m => ({ default: m.SearchScreen })));
const PreferencesScreen = React.lazy(() => import("../screens/PreferencesScreen").then(m => ({ default: m.PreferencesScreen })));
const AboutScreen = React.lazy(() => import("../screens/AboutScreen").then(m => ({ default: m.AboutScreen })));
const LibraryScreen = React.lazy(() => import("../screens/LibraryScreen").then(m => ({ default: m.LibraryScreen })));
const TrailerScreen = React.lazy(() => import("../screens/TrailerScreen").then(m => ({ default: m.TrailerScreen })));

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Préchauffe les écrans lazy les plus probables après le premier rendu de
 * l'accueil : le registre de modules étant partagé, React.lazy résout ensuite
 * instantanément (élimine le parse/exec au premier accès sur TV bas de gamme).
 */
export function preloadCoreScreens() {
  void import("../screens/LibraryScreen");
  void import("../screens/MediaDetailScreen");
  void import("../screens/PlayerScreen");
}

export function AppNavigator() {
  const { storage } = useTentacleConfig();
  const disclaimerAccepted = storage.getItem("disclaimer_accepted") === "true";
  const hasServerUrl = !!storage.getItem("tentacle_server_url");
  const hasToken = !!storage.getItem("tentacle_token");

  // Disclaimer only on first launch (no server URL yet and never accepted).
  // Sur TV, pas de page de login : sans token actif → toujours le jumellage.
  const initialRouteName = !hasServerUrl && !disclaimerAccepted
    ? "Disclaimer"
    : hasToken
      ? "Home"
      : "PairCode";

  return (
    <Suspense fallback={<SkeletonLoader />}>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{
          headerShown: false,
          animation: "fade",
          contentStyle: { backgroundColor: Colors.bgDeep },
          statusBarHidden: true,
        }}
      >
        <Stack.Screen name="Disclaimer" component={DisclaimerScreen} />
        <Stack.Screen name="PairCode" component={PairCodeScreen} />
        {/* Écrans top-level (cibles du rail) : transition INSTANTANÉE (façon
            onglets) → nav snappy ET pas de course animation/focus qui empêchait
            l'auto-collapse du rail au retour sur l'Accueil (pop). */}
        <Stack.Screen name="Home" component={HomeScreen} options={{ animation: "none" }} />
        <Stack.Screen name="Library" component={LibraryScreen} options={{ animation: "none" }} />
        <Stack.Screen name="MediaDetail" component={MediaDetailScreen} />
        <Stack.Screen name="Player" component={PlayerScreen} />
        <Stack.Screen name="Trailer" component={TrailerScreen} />
        <Stack.Screen name="Search" component={SearchScreen} options={{ animation: "none" }} />
        <Stack.Screen name="Preferences" component={PreferencesScreen} options={{ animation: "none" }} />
        <Stack.Screen name="About" component={AboutScreen} options={{ animation: "none" }} />
      </Stack.Navigator>
    </Suspense>
  );
}
