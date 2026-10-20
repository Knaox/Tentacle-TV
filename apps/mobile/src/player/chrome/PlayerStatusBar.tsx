import { useEffect, useState } from "react";
import { Platform, StatusBar, useWindowDimensions } from "react-native";
import { TABLET_MIN_WIDTH } from "@/theme";
import { statusBarPlan } from "./statusBarPlan";

interface Props {
  /** Les commandes sont à l'écran (et ne sont pas en train de s'effacer). */
  controlsVisible: boolean;
  pipActive: boolean;
}

/**
 * La barre d'état du système pendant la lecture, DÉCLARATIVE : l'entrée de
 * React Native se pose par-dessus celle de l'app tant que le lecteur est
 * monté, et s'en retire à sa fermeture — la barre de l'app revient telle
 * qu'elle était (style, visibilité). En fondu, au rythme des commandes ;
 * transparente et par-dessus l'image (bord à bord) : rien ne se remet en page.
 */
export function PlayerStatusBar({ controlsVisible, pipActive }: Props) {
  const { width, height } = useWindowDimensions();
  const plan = statusBarPlan({
    os: Platform.OS,
    isTablet: Math.min(width, height) >= TABLET_MIN_WIDTH,
    landscape: width > height,
    controlsVisible,
    pipActive,
  });
  return (
    <StatusBar
      hidden={!plan.systemBar}
      animated
      showHideTransition="fade"
      barStyle="light-content"
      translucent
      backgroundColor="transparent"
    />
  );
}

/**
 * L'état « commandes à l'écran » vu par la barre d'état : faux dès que les
 * commandes COMMENCENT à s'effacer (`onFadeStart`), pas 300 ms plus tard —
 * barre et commandes partent ensemble.
 */
export function useChromeVisibility(overlayVisible: boolean): { shown: boolean; onFadeStart: () => void } {
  const [fading, setFading] = useState(false);
  useEffect(() => { setFading(false); }, [overlayVisible]);
  return { shown: overlayVisible && !fading, onFadeStart: () => setFading(true) };
}
