/**
 * Octave (mobile, Android) — la touche Retour à la RACINE d'un onglet :
 * Rechercher ou Bibliothèque reviennent à l'Accueil (convention Material de la
 * navigation basse) au lieu de quitter l'application ; à l'Accueil, le système
 * fait comme d'habitude. Une page empilée garde le retour de la pile.
 */

import { useEffect } from "react";
import { BackHandler } from "react-native";
import { usePathname } from "expo-router";
import { isOctaveTabRoot, octavePaths } from "@tentacle-tv/shared/octave/mode";
import { useOctaveTab } from "./useOctaveTab";

export function useOctaveAndroidBack(): void {
  const pathname = usePathname();
  const { go } = useOctaveTab();
  useEffect(() => {
    if (!isOctaveTabRoot(pathname) || pathname === octavePaths.home) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      go("home");
      return true;
    });
    return () => sub.remove();
  }, [pathname, go]);
}
