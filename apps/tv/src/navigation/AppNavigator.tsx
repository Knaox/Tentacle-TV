import React, { Suspense } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { Colors } from "../theme/colors";
import type { RootStackParamList } from "./types";
import { SkeletonLoader } from "./ScreenFallback";

// Direct imports — initial screens, must load immediately
import { PairCodeScreen } from "../screens/PairCodeScreen";
import { HomeScreen } from "../screens/HomeScreen";

// Lazy-loaded screens
const LoginScreen = React.lazy(() => import("../screens/LoginScreen").then(m => ({ default: m.LoginScreen })));
const MediaDetailScreen = React.lazy(() => import("../screens/MediaDetailScreen").then(m => ({ default: m.MediaDetailScreen })));
const PlayerScreen = React.lazy(() => import("../screens/PlayerScreen").then(m => ({ default: m.PlayerScreen })));
const SearchScreen = React.lazy(() => import("../screens/SearchScreen").then(m => ({ default: m.SearchScreen })));
const PreferencesScreen = React.lazy(() => import("../screens/PreferencesScreen").then(m => ({ default: m.PreferencesScreen })));
const AboutScreen = React.lazy(() => import("../screens/AboutScreen").then(m => ({ default: m.AboutScreen })));
const LibraryScreen = React.lazy(() => import("../screens/LibraryScreen").then(m => ({ default: m.LibraryScreen })));

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const { storage } = useTentacleConfig();
  const hasServerUrl = !!storage.getItem("tentacle_server_url");
  const isAuthenticated = hasServerUrl && !!storage.getItem("tentacle_token");

  const initialRouteName = isAuthenticated ? "Home" : "PairCode";

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
        <Stack.Screen name="PairCode" component={PairCodeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Library" component={LibraryScreen} />
        <Stack.Screen name="MediaDetail" component={MediaDetailScreen} />
        <Stack.Screen name="Player" component={PlayerScreen} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="Preferences" component={PreferencesScreen} />
        <Stack.Screen name="About" component={AboutScreen} />
      </Stack.Navigator>
    </Suspense>
  );
}
