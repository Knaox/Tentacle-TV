/**
 * Octave (mobile, Android) — la touche Retour à la RACINE d'un onglet :
 * Rechercher ou Bibliothèque reviennent à l'Accueil (convention Material de la
 * navigation basse) au lieu de quitter l'application ; à l'Accueil, le système
 * fait comme d'habitude. Une page empilée garde le retour de la pile — et
 * « Sur cet appareil » (racine de « Hors ligne ») ouverte PAR-DESSUS une page
 * (compte, capsule du mode hors ligne) y revient, au lieu de sauter à l'Accueil.
 */

import { useEffect } from "react";
import { BackHandler } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { isOctaveTabRoot, octavePaths } from "@tentacle-tv/shared/octave/mode";
import { useOctaveTab } from "./useOctaveTab";

export function useOctaveAndroidBack(): void {
  const pathname = usePathname();
  const router = useRouter();
  const { go } = useOctaveTab();
  useEffect(() => {
    if (!isOctaveTabRoot(pathname) || pathname === octavePaths.home || router.canDismiss()) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      go("home");
      return true;
    });
    return () => sub.remove();
  }, [pathname, go, router]);
}
