import { useEffect } from "react";
import { usePathname } from "expo-router";
import { bootIntroGate, useReportBlockedToBootIntro } from "@tentacle-tv/brand-intro-native";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { bootRouteOf } from "./bootIntroRules";

/**
 * Ce que la racine DIT à l'ouverture : l'écran affiché (son chemin), une fois
 * l'app prête — avant, l'attente de l'app et la garde d'authentification
 * n'ont pas choisi le premier écran —, et le mode hors ligne, qui montre ce
 * qui est sur l'appareil au lieu de l'accueil : l'écran du poulpe s'y allume
 * aussitôt. Composant à part (comme `AuthRedirect`) : `usePathname` fait
 * re-rendre son hôte à chaque navigation. Ne rend rien.
 */
export function BootIntroRouteReporter({ appReady }: { appReady: boolean }) {
  const pathname = usePathname();
  const offline = useOfflineMode();
  const route = bootRouteOf(pathname, appReady);
  useEffect(() => {
    if (route !== null) bootIntroGate.reportRoute(route);
  }, [route]);
  useReportBlockedToBootIntro(appReady && offline);
  return null;
}
