import { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";
import { isServerOnlyRoute } from "./offlineRoutes";
import { useOfflineMode } from "./useOfflineMode";

/**
 * La garde de route du hors ligne : dès que la navigation locale s'impose
 * (mode manuel, ou serveur injoignable avec du contenu sur l'appareil), un
 * écran qui parle au serveur est renvoyé au catalogue local. Les modales sont
 * fermées d'abord, sinon la pile garderait une fiche vide sous l'accueil.
 * Ne rend rien ; monté une fois dans `OfflineShell`.
 */
export function OfflineRouteGuard() {
  const segments = useSegments();
  const router = useRouter();
  const offline = useOfflineMode();

  useEffect(() => {
    if (!offline || !isServerOnlyRoute(segments)) return;
    if (router.canDismiss()) router.dismissAll();
    router.replace("/(tabs)");
  }, [offline, segments, router]);

  return null;
}
