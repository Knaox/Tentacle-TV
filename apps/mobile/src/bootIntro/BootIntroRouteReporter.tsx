import { useEffect, useMemo, useSyncExternalStore } from "react";
import { usePathname, useSegments } from "expo-router";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { bootIntroGate, useBootIntroReport } from "@tentacle-tv/brand-intro-native";
import { resolveAuthRoute } from "@/auth/authRoute";
import { isSessionExpired } from "@/auth/sessionState";
import { STORED_USER_KEY } from "@/auth/storedUser";
import { isServerOnlyRoute } from "@/offline/offlineRoutes";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { readStartupOverlay, subscribeStartupOverlays } from "@/startup/startupOverlays";
import {
  BOOT_FIRST_SCREEN_OVERLAYS,
  mobileBootArrival,
  overlayBootRoute,
  overlayScreenState,
  type BootFirstScreenOverlay,
  type BootOverlayStates,
} from "./bootIntroRules";
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

  // CE QUE LA GARDE VA FAIRE, pas ce que le stockage dit à l'instant : `AuthRedirect` ne tranche qu'à
  // l'app prête et à chaque changement de route. Relu à chaque rendu, un jeton effacé après coup (un 401)
  // faisait croire à une redirection qui ne viendrait jamais — premier écran inconnu, poulpe figé.
  const routeKey = segments.join("/");
  const authRedirect = useMemo(
    () =>
      appReady
        ? resolveAuthRoute({
            segments: routeKey.split("/"),
            serverUrl: storage.getItem("tentacle_server_url"),
            token: storage.getItem("tentacle_token"),
            user: storage.getItem(STORED_USER_KEY),
            sessionExpired: isSessionExpired(),
          })
        : null,
    [appReady, routeKey, storage],
  );
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

  // « Qui regarde ? », le premier lancement : prêts quand l'écran qu'ils cachent est posé.
  const { screens } = useBootIntroReport();
  const covering = arrival.route === overlayBootRoute("profiles") || arrival.route === overlayBootRoute("firstRun");
  const coveringState = covering ? overlayScreenState(pathname, screens) : null;
  useEffect(() => {
    if (arrival.route !== null && coveringState !== null) bootIntroGate.reportScreen(arrival.route, coveringState);
  }, [arrival.route, coveringState]);
  useEffect(() => {
    if (arrival.route !== null) bootIntroGate.reportRoute(arrival.route);
  }, [arrival.route]);
  useEffect(() => {
    bootIntroGate.reportBlocked(arrival.blocked);
  }, [arrival.blocked]);
  useEffect(() => {
    bootIntroGate.reportPending(arrival.pending);
  }, [arrival.pending]);
  // Le démarrage de l'app (stockage, polices, premier montage) passé : le poulpe peut commencer (`introStart`).
  useEffect(() => {
    bootIntroGate.reportAppReady(appReady);
  }, [appReady]);
  return null;
}
