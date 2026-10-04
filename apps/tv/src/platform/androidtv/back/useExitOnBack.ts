import { useEffect } from "react";
import { BackHandler } from "react-native";

/**
 * Retour sur une surface montée HORS des écrans, qui tient le focus (le voile
 * hors ligne) : la sortie de l'application, comme sur Apple TV — Menu n'y
 * rencontre aucune portée d'écran et remonte à UIKit, qui quitte.
 *
 * Sur Android, Retour passe par BackHandler et la portée de l'écran devant le
 * prendrait (fermer un panneau, reculer) sous une surface qui le cache. Tant
 * que `active`, l'écouteur inscrit ici, le plus récent, passe avant elle
 * (BackHandler sert le dernier inscrit d'abord) et quitte.
 */
export function useExitOnBack(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      BackHandler.exitApp();
      return true;
    });
    return () => subscription.remove();
  }, [active]);
}
