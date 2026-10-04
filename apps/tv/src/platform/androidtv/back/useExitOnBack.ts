import { useEffect } from "react";
import { BackHandler } from "react-native";
import { takeBack } from "../input";

/**
 * Retour sur une surface montée HORS des écrans, qui tient le focus (le voile
 * hors ligne) : la sortie de l'application, comme sur Apple TV — Menu n'y
 * rencontre aucune portée d'écran et remonte à UIKit, qui quitte.
 *
 * Sur Android, Retour est proposé aux preneurs (`takeBack`) et la portée de
 * l'écran devant le prendrait (fermer un panneau, reculer) sous une surface
 * qui le cache. Tant que `active`, le preneur inscrit ici, le plus récent,
 * passe avant elle (le dernier inscrit répond le premier) et quitte.
 */
export function useExitOnBack(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    return takeBack(() => {
      BackHandler.exitApp();
      return true;
    });
  }, [active]);
}
