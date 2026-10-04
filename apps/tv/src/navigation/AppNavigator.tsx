import React, { Suspense } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { tvSessionMode } from "@tentacle-tv/tv-core";
import { TV_MOTION } from "@tentacle-tv/theme";
import { Colors } from "../theme/colors";
import type { RootStackParamList } from "./types";
import { SkeletonLoader } from "./ScreenFallback";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { REDESIGN_ACTIVE } from "../redesignWiring/redesignGate";
import { BackScope } from "../redesignWiring/back/BackScope";

// Direct imports — initial screens, must load immediately
import { DisclaimerScreen } from "../screens/DisclaimerScreen";
import { PairCodeScreen } from "../screens/PairCodeScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { PlayerSettingsScreen } from "../screens/player/PlayerSettingsScreen";
import { ProfilesScreen } from "../screens/ProfilesScreen";

// Lazy-loaded screens
const MediaDetailScreen = React.lazy(() => import("../screens/MediaDetailScreen").then(m => ({ default: m.MediaDetailScreen })));
const PlayerScreen = React.lazy(() => import("../screens/PlayerScreen").then(m => ({ default: m.PlayerScreen })));
const SearchScreen = React.lazy(() => import("../screens/SearchScreen").then(m => ({ default: m.SearchScreen })));
const RecommendationsScreen = React.lazy(() => import("../screens/RecommendationsScreen").then(m => ({ default: m.RecommendationsScreen })));
const SearchBrowseScreen = React.lazy(() => import("../screens/SearchBrowseScreen").then(m => ({ default: m.SearchBrowseScreen })));
const SettingsScreen = React.lazy(() => import("../screens/SettingsScreen").then(m => ({ default: m.SettingsScreen })));
const LibraryScreen = React.lazy(() => import("../screens/LibraryScreen").then(m => ({ default: m.LibraryScreen })));
const TrailerScreen = React.lazy(() => import("../screens/TrailerScreen").then(m => ({ default: m.TrailerScreen })));
const WatchlistScreen = React.lazy(() => import("../screens/WatchlistScreen").then(m => ({ default: m.WatchlistScreen })));
const FavoritesScreen = React.lazy(() => import("../screens/FavoritesScreen").then(m => ({ default: m.FavoritesScreen })));
const ManageProfilesScreen = React.lazy(() => import("../screens/ManageProfilesScreen").then(m => ({ default: m.ManageProfilesScreen })));
const ProfilePinScreen = React.lazy(() => import("../screens/ProfilePinScreen").then(m => ({ default: m.ProfilePinScreen })));

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Le fondu enchaîné de la pile native (react-native-screens : un animateur
 * UIKit, joué par Core Animation, sans JS). Apple TV (refonte) : la durée de
 * `TV_MOTION` — un écran poussé (la fiche d'une carte) se pose en 320 ms au
 * lieu de 500, pendant que son image se pose et que son en-tête arrive
 * (`DetailBackdrop`, `DetailHeader`). Android TV : la durée par défaut, rien
 * ne change.
 */
const FADE_MS: number | undefined = REDESIGN_ACTIVE ? TV_MOTION.page.fadeMs : undefined;

/**
 * Préchauffe les écrans lazy après le premier rendu de l'accueil : le registre
 * de modules étant partagé, React.lazy résout ensuite instantanément (élimine
 * le parse/exec au premier accès sur TV bas de gamme). Toutes les cibles du
 * rail y passent — le fallback par écran ne se verra qu'exceptionnellement.
 * Trailer reste à la demande : uniquement accessible depuis une fiche déjà
 * chargée, jamais dans le chemin critique.
 */
export function preloadCoreScreens() {
  void import("../screens/LibraryScreen");
  void import("../screens/MediaDetailScreen");
  void import("../screens/PlayerScreen");
  void import("../screens/SearchScreen");
  void import("../screens/SearchBrowseScreen");
  void import("../screens/RecommendationsScreen");
  void import("../screens/SettingsScreen");
  void import("../screens/WatchlistScreen");
  void import("../screens/FavoritesScreen");
}

export function AppNavigator() {
  const { storage } = useTentacleConfig();
  const disclaimerAccepted = storage.getItem("disclaimer_accepted") === "true";
  const hasServerUrl = !!storage.getItem("tentacle_server_url");
  const hasToken = !!storage.getItem("tentacle_token");
  // Apple TV passée aux profils (Famille), aucun profil ouvert : « Qui regarde ? ».
  const choosing = tvSessionMode(storage) === "choosing";

  // Les conditions d'utilisation, au premier lancement seulement (aucun serveur
  // ni acceptation) — Android TV seulement : la refonte (Apple TV) les a
  // retirées, sa langue se choisit sur l'accueil du jumelage. La clé
  // `disclaimer_accepted` reste celle d'Android TV : ne jamais la renommer.
  // Sur TV, pas de page de login : sans token actif → toujours le jumelage.
  const showDisclaimer = !REDESIGN_ACTIVE && !hasServerUrl && !disclaimerAccepted;
  const initialRouteName = showDisclaimer
    ? "Disclaimer"
    : choosing
      ? "Profiles"
      : hasToken
        ? "Home"
        : "PairCode";

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        animation: "fade",
        animationDuration: FADE_MS,
        contentStyle: { backgroundColor: Colors.bgDeep },
        statusBarHidden: true,
        // Apple TV : Menu ne dépile jamais un écran de lui-même — la pile de
        // couches du Retour décide (`BackScope`), et UIKit ne garde que la
        // sortie de l'application. Android TV : sans effet.
        gestureEnabled: !REDESIGN_ACTIVE,
      }}
      // Frontière de chargement PAR ÉCRAN, pas autour du Navigator : un
      // Suspense global gèle tout l'arbre à la première navigation vers un
      // écran lazy (react-native-screens fige les écrans inactifs via
      // react-freeze) → squelette plein écran et focus natif perdu. Ici
      // l'écran courant reste affiché pendant le chargement, et un crash ne
      // remplace que l'écran fautif — le rail (sibling du Navigator) survit.
      // Autour de tout : la portée du Retour (Apple TV), qui sert aussi
      // l'erreur et le chargement de l'écran.
      screenLayout={({ children, route, navigation }) => (
        <BackScope route={route} navigation={navigation}>
          <ErrorBoundary route={route}>
            <Suspense fallback={<SkeletonLoader route={route} />}>{children}</Suspense>
          </ErrorBoundary>
        </BackScope>
      )}
    >
      {REDESIGN_ACTIVE ? null : <Stack.Screen name="Disclaimer" component={DisclaimerScreen} />}
      <Stack.Screen name="PairCode" component={PairCodeScreen} />
      {/* La Famille (Apple TV) : « Qui regarde ? » et « Gérer les profils ». */}
      <Stack.Screen name="Profiles" component={ProfilesScreen} initialParams={{ intent: "launch" }} options={{ animation: "none" }} />
      <Stack.Screen name="ManageProfiles" component={ManageProfilesScreen} />
      <Stack.Screen name="ProfilePin" component={ProfilePinScreen} />
      {/* Écrans top-level (cibles du rail) : transition INSTANTANÉE (façon
          onglets) → nav snappy ET pas de course animation/focus qui empêchait
          l'auto-collapse du rail au retour sur l'Accueil (pop). */}
      {/* Sauf l'arrivée depuis « Qui regarde ? » (`entrance`) : l'accueil fond
          par-dessus la rangée, où le profil choisi s'est avancé — il charge
          pendant le fondu (TV_MOTION.profile). */}
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={({ route }) => (route.params?.entrance ? { animation: "fade", animationDuration: TV_MOTION.profile.homeFadeMs } : { animation: "none" })}
      />
      <Stack.Screen name="Library" component={LibraryScreen} options={{ animation: "none" }} />
      <Stack.Screen name="Recommendations" component={RecommendationsScreen} options={{ animation: "none" }} />
      <Stack.Screen name="MediaDetail" component={MediaDetailScreen} />
      {/* `animation: none` : une sortie instantanée. Le Menu qu'un panneau
          ouvert doit consommer (usePreventRemove) ne dépile plus rien : le
          patch tvOS de react-native-screens l'avale avant UIKit. Avant lui,
          l'écran était dépilé puis restauré — et l'accueil CLIGNOTAIT une
          image, animation ou pas (un fondu devenait un fondu enchaîné). */}
      <Stack.Screen name="Player" component={PlayerScreen} options={{ animation: "none" }} />
      {/* Réglages/Qualité en MODALE transparente : ESC ferme la modale
          proprement (révèle l'épisode), pas de flash de page précédente. */}
      <Stack.Screen
        name="PlayerSettings"
        component={PlayerSettingsScreen}
        options={{
          presentation: "transparentModal",
          animation: "fade",
          // Sans ça, le `contentStyle` opaque global (bgDeep) masquerait la
          // vidéo sous la modale → fond transparent pour voir l'épisode.
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
      <Stack.Screen name="Trailer" component={TrailerScreen} />
      <Stack.Screen name="Search" component={SearchScreen} options={{ animation: "none" }} />
      <Stack.Screen name="SearchBrowse" component={SearchBrowseScreen} />
      <Stack.Screen name="Watchlist" component={WatchlistScreen} options={{ animation: "none" }} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} options={{ animation: "none" }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ animation: "none" }} />
    </Stack.Navigator>
  );
}
