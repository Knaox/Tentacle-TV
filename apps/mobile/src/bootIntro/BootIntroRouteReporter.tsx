import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useSegments } from "expo-router";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { bootIntroGate } from "@tentacle-tv/brand-intro-native";
import { resolveAuthRoute } from "@/auth/authRoute";
import { isSessionExpired } from "@/auth/sessionState";
import { STORED_USER_KEY } from "@/auth/storedUser";
import { isServerOnlyRoute } from "@/offline/offlineRoutes";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { readStartupOverlay, subscribeStartupOverlays } from "@/startup/startupOverlays";
import { BOOT_FIRST_SCREEN_OVERLAYS, mobileBootArrival, type BootFirstScreenOverlay, type BootOverlayStates } from "./bootIntroRules";
import { useShownBootOverlays } from "./bootOverlays";

/** L'état des recouvrements du premier écran, en une chaîne stable (le magasin rend une valeur par lecture). */
const overlayKey = (): string => BOOT_FIRST_SCREEN_OVERLAYS.map((overlay) => readStartupOverlay(overlay)).join(",");

/**
 * Ce que la racine DIT à l'ouverture : LE PREMIER ÉCRAN RÉEL (règle
 * `mobileBootArrival`) — rien tant que l'app n'est pas prête ou qu'une garde
 * (authentification, hors ligne) va remplacer la route ; un recouvrement plein
 * écran (« Qui regarde ? », premier lancement, migration, accès suspendu) dès
 * qu'il est À L'ÉCRAN, l'attente tant qu'il n'a pas tranché ; sinon le chemin
 * affiché. Composant à part (comme `AuthRedirect`) : `usePathname` fait
 * re-rendre son hôte à chaque navigation. Ne rend rien.
 */
export function BootIntroRouteReporter({ appReady }: { appReady: boolean }) {
  const pathname = usePathname();
  const segments = useSegments();
  const offline = useOfflineMode();
  const { storage } = useTentacleConfig();
  const shown = useShownBootOverlays();
  const reported = useSyncExternalStore(subscribeStartupOverlays, overlayKey, overlayKey);

  const authRedirect = appReady
    ? resolveAuthRoute({
        segments,
        serverUrl: storage.getItem("tentacle_server_url"),
        token: storage.getItem("tentacle_token"),
        user: storage.getItem(STORED_USER_KEY),
        sessionExpired: isSessionExpired(),
      })
    : null;
  const overlays: BootOverlayStates = {};
  reported.split(",").forEach((state, index) => {
    const overlay = BOOT_FIRST_SCREEN_OVERLAYS[index] as BootFirstScreenOverlay;
    overlays[overlay] = state as "pending" | "active" | "quiet";
  });
  const arrival = mobileBootArrival({
    appReady,
    pathname,
    redirecting: authRedirect !== null || (offline && isServerOnlyRoute(segments)),
    offline,
    overlays,
    shown,
  });

  useEffect(() => {
    if (arrival.route !== null) bootIntroGate.reportRoute(arrival.route);
  }, [arrival.route]);
  useEffect(() => {
    bootIntroGate.reportBlocked(arrival.blocked);
  }, [arrival.blocked]);
  useEffect(() => {
    bootIntroGate.reportPending(arrival.pending);
  }, [arrival.pending]);
  return null;
}
