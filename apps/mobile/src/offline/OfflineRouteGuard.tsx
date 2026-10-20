import { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";
import { isAccountOfflineRoute, isServerOnlyRoute } from "./offlineRoutes";
import { useOfflineProfileSession } from "./rights/useOfflineOwner";
import { useOfflineMode } from "./useOfflineMode";

/**
 * La garde de route du hors ligne : dès que la navigation locale s'impose
 * (mode manuel, ou serveur injoignable avec du contenu sur l'appareil), un
 * écran qui parle au serveur est renvoyé au catalogue local. Les modales sont
 * fermées d'abord, sinon la pile garderait une fiche vide sous l'accueil.
 * Une session de PROFIL n'a pas de hors ligne (il est au compte de
 * l'appareil) : ses routes la renvoient aussi à l'accueil, en ligne ou non.
 * Ne rend rien ; monté une fois dans `OfflineShell`.
 */
export function OfflineRouteGuard() {
  const segments = useSegments();
  const router = useRouter();
  const offline = useOfflineMode();
  const profileSession = useOfflineProfileSession();

  useEffect(() => {
    const refused = (offline && isServerOnlyRoute(segments)) || (profileSession && isAccountOfflineRoute(segments));
    if (!refused) return;
    if (router.canDismiss()) router.dismissAll();
    router.replace("/(tabs)");
  }, [offline, profileSession, segments, router]);

  return null;
}
